import { Redis } from "@upstash/redis"

let client: Redis | null = null

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

if (UPSTASH_URL && UPSTASH_TOKEN) {
  client = new Redis({
    url: UPSTASH_URL,
    token: UPSTASH_TOKEN,
    automaticDeserialization: false,
  })
}

export function getRedis(): Redis | null {
  return client
}

