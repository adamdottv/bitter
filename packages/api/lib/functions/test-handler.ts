import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager"
import {
  CloudWatchClient,
  PutMetricDataCommand,
} from "@aws-sdk/client-cloudwatch"
import { ProfileInput, MyProfile, OtherProfile } from "../../__generated__"
import Chance from "chance"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb"
import fetch, { Response } from "node-fetch"
import jwt from "jsonwebtoken"
import ShortUniqueId from "short-unique-id"
import { v4 as uuidv4 } from "uuid"

const chance = new Chance()
const uid = new ShortUniqueId()

const secretArn = process.env.SECRET_ARN as string
const TableName = process.env.TABLE_NAME as string
const apiUrl = process.env.API_URL as string

const cloudwatch = new CloudWatchClient({ region: "us-east-1" })

const secretsManager = new SecretsManagerClient({
  region: process.env.AWS_REGION,
})
const { SecretString: secret } = await secretsManager.send(
  new GetSecretValueCommand({ SecretId: secretArn })
)

const dynamodbClient = new DynamoDBClient({ region: process.env.AWS_REGION })
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
})

export const handler = async (): Promise<void> => {
  const promises = []
  for (let index = 0; index < 100; index++) {
    promises.push(session())
  }

  await Promise.all(promises)
}

export const session = async () => {
  if (!secret) throw Error("No secret environment variable set")

  const id = uuidv4()
  const profile: ProfileInput = {
    id,
    name: chance.name(),
    handle: uid(),
  }

  const pk = `PROFILE#${id}`
  await dynamodb.send(
    new PutCommand({
      TableName,
      Item: {
        ...profile,
        pk,
        sk: pk,
        gsi1pk: profile.handle,
        gsi1sk: profile.handle,
        type: "PROFILE",
        createdAt: new Date().toISOString(),
        followingCount: 0,
        followerCount: 0,
        beetsCount: 0,
      },
    })
  )

  const token = jwt.sign({ ...profile, sub: profile.id }, secret) // create jwt token

  const myProfile = await request<MyProfile>(
    token,
    "getMyProfile",
    "query { getMyProfile { id name handle } }"
  )
  console.log(myProfile)

  // get random profiles
  const startKey = `PROFILE#${uuidv4()}`
  const scanResponse = await dynamodb.send(
    new ScanCommand({
      TableName,
      Limit: 10,
      ExclusiveStartKey: {
        pk: startKey,
        sk: startKey,
      },
      FilterExpression: `#type = :type`,
      ExpressionAttributeNames: {
        "#type": "type",
      },
      ExpressionAttributeValues: {
        ":type": "PROFILE",
      },
    })
  )
  const profiles = scanResponse.Items as OtherProfile[]
  console.log(profiles)

  for (const profile of profiles) {
    if (profile.id === myProfile?.id) continue

    await request(
      token,
      "follow",
      `mutation($userId: ID!) { follow(userId: $userId) }`,
      { userId: profile.id }
    )
  }

  await request(
    token,
    "beet",
    `mutation($text: String!) { beet(text: $text) }`,
    { text: chance.sentence() }
  )
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms))

async function request<T>(
  token: string,
  operation: string,
  query: string,
  variables?: object
): Promise<T | undefined> {
  // start a timer
  const start = Date.now()
  let response: Response | undefined = undefined

  const makeRequest = async () => {
    return fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    })
  }

  let count = 0
  do {
    try {
      response = await makeRequest()
    } catch (error) {
      console.error(error)
    }
    count++
    await delay(100 * count)
  } while (!response)

  const durationMs = Date.now() - start

  const raw = await response.json()
  console.log(raw)

  const json = raw as { data: { [operation: string]: T }; errors: unknown[] }
  const error = json.errors && json.errors.length

  const cwResponse = await cloudwatch.send(
    new PutMetricDataCommand({
      Namespace: "bitter",
      MetricData: [
        error
          ? {
              MetricName: "error",
              Dimensions: [
                {
                  Name: "region",
                  Value: process.env.AWS_REGION as string,
                },
                {
                  Name: "operation",
                  Value: operation,
                },
              ],
              Unit: "None",
              Timestamp: new Date(),
              Value: 1,
              StorageResolution: 1,
            }
          : {
              MetricName: operation,
              Dimensions: [
                {
                  Name: "region",
                  Value: process.env.AWS_REGION as string,
                },
              ],
              Unit: "None",
              Timestamp: new Date(),
              Value: 1,
              StorageResolution: 1,
            },
        {
          MetricName: "latency",
          Dimensions: [
            {
              Name: "region",
              Value: process.env.AWS_REGION as string,
            },
            {
              Name: "operation",
              Value: operation,
            },
          ],
          Unit: "Milliseconds",
          Timestamp: new Date(),
          Value: durationMs,
          StorageResolution: 1,
        },
      ],
    })
  )
  console.log(cwResponse)

  return json ? json.data[operation] : undefined
}
