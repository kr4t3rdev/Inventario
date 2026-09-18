import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

export const SDK_NAMES = ['typescript', 'dart', 'swift', 'kotlin'];
const GENERATOR_CONFIG = JSON.parse(readFileSync('openapitools.json', 'utf8')).generator;
const SECRET_PROPERTY_PATTERN = /\b(?:password|accessToken|refreshToken|token)\b/;

/**
 * @description Recursively lists generated files.
 * @param {string} directory - Directory to inspect.
 * @returns {string[]} Generated file paths.
 */
function listGeneratedFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listGeneratedFiles(entryPath) : [entryPath];
  });
}

/**
 * @description Removes generated publishing scripts and packaged build artifacts.
 * @param {string} directory - Generated SDK root.
 * @returns {void}
 */
function removeGeneratedPublishingArtifacts(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (/^(?:dist|build|\.dart_tool|\.gradle)$/.test(entry.name)) {
        rmSync(entryPath, { recursive: true, force: true });
      } else {
        removeGeneratedPublishingArtifacts(entryPath);
      }
      continue;
    }
    if (entry.name === 'git_push.sh' || /\.(?:tgz|tar|tar\.gz|zip)$/i.test(entry.name)) {
      rmSync(entryPath, { force: true });
    }
  }

  const manifest = path.join(directory, '.openapi-generator', 'FILES');
  try {
    const entries = readFileSync(manifest, 'utf8')
      .split(/\r?\n/)
      .filter((entry) => entry && entry !== 'git_push.sh');
    writeFileSync(manifest, `${entries.join('\n')}\n`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

/**
 * @description Redacts secret interpolation from generated Dart model representations.
 * @param {string} outputDirectory - Dart SDK root.
 * @returns {void}
 */
function redactDartRepresentations(outputDirectory) {
  const modelDirectory = path.join(outputDirectory, 'lib/model');
  for (const file of listGeneratedFiles(modelDirectory).filter((entry) => entry.endsWith('.dart'))) {
    const source = readFileSync(file, 'utf8');
    if (!SECRET_PROPERTY_PATTERN.test(source) || !source.includes('String toString()')) continue;
    writeFileSync(
      file,
      source.replace(/\$(?:password|accessToken|refreshToken|token)\b/g, '<redacted>'),
    );
  }
}

/**
 * @description Adds redacted toString overrides to generated Kotlin credential models.
 * @param {string} outputDirectory - Kotlin SDK root.
 * @returns {void}
 */
function redactKotlinRepresentations(outputDirectory) {
  const modelDirectory = path.join(
    outputDirectory,
    'src/main/kotlin/com/tcp/mobile/v1/models',
  );
  for (const file of listGeneratedFiles(modelDirectory).filter((entry) => entry.endsWith('.kt'))) {
    const source = readFileSync(file, 'utf8');
    if (!/val\s+(?:password|accessToken|refreshToken|token)\b/.test(source)) continue;
    if (source.includes('override fun toString(): String')) continue;
    const className = source.match(/data class\s+(\w+)/)?.[1];
    const closingBrace = source.lastIndexOf('\n}');
    if (!className || closingBrace < 0) throw new Error(`Cannot redact Kotlin model ${file}.`);
    const redacted = `\n    override fun toString(): String = "${className}(<redacted>)"\n`;
    writeFileSync(file, source.slice(0, closingBrace) + redacted + source.slice(closingBrace));
  }
}

/**
 * @description Adds redacted descriptions to generated Swift credential models.
 * @param {string} outputDirectory - Swift SDK root.
 * @returns {void}
 */
function redactSwiftRepresentations(outputDirectory) {
  const modelDirectory = path.join(outputDirectory, 'Sources/Models');
  for (const file of listGeneratedFiles(modelDirectory).filter((entry) => entry.endsWith('.swift'))) {
    let source = readFileSync(file, 'utf8');
    if (!/public var (?:password|accessToken|refreshToken|token)\b/.test(source)) continue;
    if (source.includes('CustomStringConvertible')) continue;
    const className = source.match(/public struct\s+(\w+):/)?.[1];
    if (!className) throw new Error(`Cannot redact Swift model ${file}.`);
    source = source.replace(
      `public struct ${className}:`,
      `public struct ${className}: CustomStringConvertible,`,
    );
    const modelStart = source.indexOf('{', source.indexOf(`public struct ${className}:`));
    let depth = 0;
    let closingBrace = -1;
    for (let index = modelStart; index < source.length; index += 1) {
      if (source[index] === '{') depth += 1;
      if (source[index] === '}') depth -= 1;
      if (depth === 0) {
        closingBrace = index;
        break;
      }
    }
    if (modelStart < 0 || closingBrace < 0) {
      throw new Error(`Cannot locate Swift model scope in ${file}.`);
    }
    const redacted = `\n    public var description: String { "${className}(<redacted>)" }\n`;
    writeFileSync(file, source.slice(0, closingBrace) + redacted + source.slice(closingBrace));
  }
}

/**
 * @description Resolves and validates the pinned Java and generator JAR runtime.
 * @returns {{ java: string, jar: string }} Validated runtime paths.
 */
export function resolveGeneratorRuntime() {
  const jar = path.resolve(process.env.OPENAPI_GENERATOR_JAR ?? GENERATOR_CONFIG.jarPath);
  const java = process.env.JAVA_BIN ?? (
    process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin/java') : 'java'
  );

  let jarBytes;
  try {
    jarBytes = readFileSync(jar);
  } catch {
    throw new Error(
      `OpenAPI Generator JAR not found at ${jar}. Set OPENAPI_GENERATOR_JAR to the ` +
      `pinned ${GENERATOR_CONFIG.version} JAR.`,
    );
  }

  const checksum = createHash('sha256').update(jarBytes).digest('hex');
  if (checksum !== GENERATOR_CONFIG.sha256) {
    throw new Error(
      `OpenAPI Generator JAR checksum mismatch: expected ${GENERATOR_CONFIG.sha256}, ` +
      `received ${checksum}.`,
    );
  }

  const javaCheck = spawnSync(java, ['-version'], { encoding: 'utf8' });
  if (javaCheck.error || javaCheck.status !== 0) {
    throw new Error(
      `Java 21 runtime is unavailable at ${java}. Set JAVA_BIN or JAVA_HOME before generation.`,
    );
  }

  return { java, jar };
}

/**
 * @description Applies deterministic platform fixes not emitted by OpenAPI Generator.
 * @param {string} sdk - Generated SDK name.
 * @param {string} outputDirectory - Generated SDK output directory.
 * @returns {void}
 */
export function postprocessGeneratedSdk(sdk, outputDirectory) {
  removeGeneratedPublishingArtifacts(outputDirectory);

  if (sdk === 'dart') {
    redactDartRepresentations(outputDirectory);
    return;
  }

  if (sdk === 'kotlin') {
    redactKotlinRepresentations(outputDirectory);
    return;
  }

  if (sdk === 'typescript') {
    const jsonValueFile = path.join(outputDirectory, 'src/models/JsonValue.ts');
    writeFileSync(jsonValueFile, `/* tslint:disable */
/* eslint-disable */
/**
 * TCP Mobile API
 * Generated by OpenAPI Generator and normalized by scripts/openapi/generate.mjs.
 */

/** JSON value supported by dynamic metadata fields. */
export type JsonValue =
    | null
    | boolean
    | number
    | string
    | JsonValue[]
    | { [key: string]: JsonValue };

export function JsonValueFromJSON(json: any): JsonValue {
    return JsonValueFromJSONTyped(json, false);
}

export function JsonValueFromJSONTyped(json: any, _ignoreDiscriminator: boolean): JsonValue {
    return json as JsonValue;
}

export function JsonValueToJSON(value: any): any {
    return JsonValueToJSONTyped(value, false);
}

export function JsonValueToJSONTyped(
    value?: JsonValue | null,
    _ignoreDiscriminator: boolean = false,
): any {
    return value;
}
`);
    return;
  }

  if (sdk !== 'swift') return;

  const jsonValueFile = path.join(outputDirectory, 'Sources/Models/JsonValue.swift');
  writeFileSync(jsonValueFile, `//
// JsonValue.swift
// Generated by OpenAPI Generator and normalized by scripts/openapi/generate.mjs.
//

import Foundation

/** A JSON value supported by dynamic metadata fields. */
public enum JsonValue: Codable, JSONEncodable, Hashable {
    case null
    case bool(Bool)
    case double(Double)
    case int(Int)
    case string(String)
    case array([JsonValue])
    case object([String: JsonValue])

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case .bool(let value): try container.encode(value)
        case .double(let value): try container.encode(value)
        case .int(let value): try container.encode(value)
        case .string(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null }
        else if let value = try? container.decode(Bool.self) { self = .bool(value) }
        else if let value = try? container.decode(Int.self) { self = .int(value) }
        else if let value = try? container.decode(Double.self) { self = .double(value) }
        else if let value = try? container.decode(String.self) { self = .string(value) }
        else if let value = try? container.decode([JsonValue].self) { self = .array(value) }
        else if let value = try? container.decode([String: JsonValue].self) {
            self = .object(value)
        } else {
            throw DecodingError.typeMismatch(
                Self.self,
                .init(codingPath: decoder.codingPath, debugDescription: "Invalid JSON value")
            )
        }
    }
}
`);

  const paymentTypeResponseFile = path.join(
    outputDirectory,
    'Sources/Models/PutAccountingPaymentTypesIdResponse.swift',
  );
  const paymentTypeResponse = readFileSync(paymentTypeResponseFile, 'utf8');
  writeFileSync(paymentTypeResponseFile, paymentTypeResponse.replaceAll('AnyCodable?', 'Bool?'));
  redactSwiftRepresentations(outputDirectory);

  const apiFile = path.join(outputDirectory, 'Sources/APIs.swift');
  const source = readFileSync(apiFile, 'utf8');
  if (source.includes('    public static var accessToken: String? {\n')) return;

  const marker = '    public static var customHeaders: [String: String] = [:]\n';
  const bearerConfiguration = `${marker}    public static var accessToken: String? {\n` +
    '        didSet {\n' +
    '            if let accessToken, !accessToken.isEmpty {\n' +
    '                customHeaders["Authorization"] = "Bearer \\(accessToken)"\n' +
    '            } else {\n' +
    '                customHeaders.removeValue(forKey: "Authorization")\n' +
    '            }\n' +
    '        }\n' +
    '    }\n';

  if (!source.includes(marker)) {
    throw new Error(`Swift postprocessing marker not found in ${apiFile}`);
  }
  writeFileSync(apiFile, source.replace(marker, bearerConfiguration));
}

/**
 * @description Runs the repository-pinned OpenAPI Generator for one SDK.
 * @param {string} sdk - SDK configuration name.
 * @param {string | undefined} outputDirectory - Optional output override.
 * @returns {void}
 */
export function generateSdk(sdk, outputDirectory) {
  const resolvedOutput = path.resolve(outputDirectory ?? path.join('sdks/mobile-v1', sdk));
  const runtime = resolveGeneratorRuntime();
  const outputParent = path.dirname(resolvedOutput);
  mkdirSync(outputParent, { recursive: true });
  const stagingRoot = mkdtempSync(path.join(outputParent, `.${path.basename(resolvedOutput)}-staging-`));
  const stagedOutput = path.join(stagingRoot, 'output');
  const backupOutput = path.join(stagingRoot, 'previous');
  const argumentsList = [
    '-jar',
    runtime.jar,
    'generate',
    '--config',
    `openapi-generator/${sdk}.yaml`,
  ];
  argumentsList.push('--output', stagedOutput);

  try {
    const result = spawnSync(runtime.java, argumentsList, {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' },
    });
    if (result.status !== 0) {
      throw new Error(`OpenAPI Generator failed for ${sdk} with status ${result.status ?? 1}.`);
    }
    postprocessGeneratedSdk(sdk, stagedOutput);

    let previousOutputMoved = false;
    try {
      renameSync(resolvedOutput, backupOutput);
      previousOutputMoved = true;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }

    try {
      renameSync(stagedOutput, resolvedOutput);
    } catch (error) {
      if (previousOutputMoved) renameSync(backupOutput, resolvedOutput);
      throw error;
    }
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try {
    resolveGeneratorRuntime();
    for (const sdk of SDK_NAMES) {
      generateSdk(sdk);
    }
  } catch (error) {
    console.error(`[openapi] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
