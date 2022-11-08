import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager"
import { ProfileInput } from "../../__generated__"
import { ulid } from "ulid"
import Chance from "chance"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb"
import fetch from "node-fetch"
import jwt from "jsonwebtoken"

const chance = new Chance()

const secretsManager = new SecretsManagerClient({
  region: process.env.AWS_REGION,
})
const secretArn = process.env.SECRET_ARN as string
const { SecretString: secret } = await secretsManager.send(
  new GetSecretValueCommand({ SecretId: secretArn })
)

const TableName = process.env.TABLE_NAME as string
const dynamodbClient = new DynamoDBClient({ region: process.env.AWS_REGION })
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
})

const apiUrl = process.env.API_URL as string

export const handler = async (): Promise<void> => {
  if (!secret) throw Error("No secret environment variable set")

  const id = ulid()
  const profile: ProfileInput = {
    id,
    name: chance.name(),
    handle: chance.twitter(),
  }

  const pk = `PROFILE#${id}`
  const response = await dynamodb.send(
    new PutCommand({
      TableName,
      Item: {
        ...profile,
        pk,
        sk: pk,
        type: "PROFILE",
        createdAt: new Date().toISOString(),
      },
    })
  )

  const token = jwt.sign({ ...profile, sub: profile.id }, secret) // create jwt token

  const myProfile = await fetch(apiUrl, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query { getMyProfile }`,
    }),
  })
  const json = await myProfile.json()
  console.log(json)

  // 1. create profile
  // 2. follow some profiles
  // 3. write some beets
  // 4. rebeet some beets
  // 5. like some beets, etc.
}
