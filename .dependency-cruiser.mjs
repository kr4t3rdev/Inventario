/** @type {import('dependency-cruiser').IConfiguration} */
export default {
	forbidden: [
		{
			name: "no-circular",
			comment: "Dependencias circulares no están permitidas",
			severity: "error",
			from: {},
			to: { circular: true },
		},
		{
			name: "no-orphans",
			comment: "Módulos huérfanos sin dependencias ni dependientes",
			severity: "warn",
			from: { orphan: true },
			to: {},
		},
		{
			name: "lib-not-dependent-on-features",
			comment: "lib/ no debe depender de features/ ni components/",
			severity: "error",
			from: { path: "^src/lib/" },
			to: { path: "^(src/features/|src/components/)" },
		},
		{
			name: "ui-not-dependent-on-business",
			comment: "components/ui no debe depender de components/ de negocio",
			severity: "error",
			from: { path: "^src/components/ui/" },
			to: { path: "^src/components/(?!ui/)" },
		},
		{
			name: "features-not-dependent-on-features",
			comment: "Features no deben depender de otros features directamente",
			severity: "warn",
			from: { path: "^src/features/" },
			to: { path: "^src/features/" },
		},
	],
	options: {
		doNotFollow: {
			path: "node_modules",
			dependencyTypes: [
				"npm",
				"npm-dev",
				"npm-optional",
				"npm-peer",
				"npm-bundled",
				"npm-no-pkg",
			],
		},
		includeOnly: "^src",
		exclude: {
			path: [
				"\\.next",
				"__tests__",
				"\\.test\\.",
				"\\.spec\\.",
				"__mocks__",
				"next-env\\.d\\.ts",
			],
		},
		tsConfig: {
			fileName: "tsconfig.json",
		},
		enhancedResolveOptions: {
			exportsFields: ["exports"],
			conditionNames: ["import", "require", "node", "default"],
		},
		reporterOptions: {
			dot: {
				theme: {
					modules: [
						{
							criteria: { source: "^src/app" },
							attributes: {
								shape: "box3d",
								fillcolor: "#e0f2fe",
								color: "#0284c7",
							},
						},
						{
							criteria: { source: "^src/features" },
							attributes: {
								shape: "box",
								fillcolor: "#fef3c7",
								color: "#d97706",
							},
						},
						{
							criteria: { source: "^src/components" },
							attributes: {
								shape: "box",
								fillcolor: "#d1fae5",
								color: "#059669",
							},
						},
						{
							criteria: { source: "^src/lib" },
							attributes: {
								shape: "box",
								fillcolor: "#ede9fe",
								color: "#7c3aed",
							},
						},
						{
							criteria: { source: "^src/hooks" },
							attributes: {
								shape: "box",
								fillcolor: "#fce7f3",
								color: "#db2777",
							},
						},
						{
							criteria: { source: "^src/contexts" },
							attributes: {
								shape: "box",
								fillcolor: "#ffedd5",
								color: "#ea580c",
							},
						},
						{
							criteria: { source: "^src/generated" },
							attributes: {
								shape: "cylinder",
								fillcolor: "#d1d5db",
								color: "#6b7280",
							},
						},
						{
							criteria: { source: "^src/types" },
							attributes: {
								shape: "note",
								fillcolor: "#fef9c3",
								color: "#a16207",
							},
						},
					],
					graph: {
						splines: "polyline",
						rankdir: "LR",
						ranksep: "1.5",
						bgcolor: "#fafafa",
					},
				},
			},
		},
	},
};
