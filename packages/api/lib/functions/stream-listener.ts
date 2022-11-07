import { AttributeValue } from "@aws-sdk/client-dynamodb"
import { unmarshall } from "@aws-sdk/util-dynamodb"
import { DynamoDBStreamHandler } from "aws-lambda"
import { DatabaseItem } from "../types"

export const handler: DynamoDBStreamHandler = async (event): Promise<void> => {
  for (const record of event.Records) {
    const newImage = record.dynamodb!.NewImage as {
      [key: string]: AttributeValue
    }
    const oldImage = record.dynamodb!.OldImage as {
      [key: string]: AttributeValue
    }

    const newItem = newImage
      ? (unmarshall(newImage) as DatabaseItem)
      : undefined
    const oldItem = oldImage
      ? (unmarshall(oldImage) as DatabaseItem)
      : undefined
    const item = (newItem ?? oldItem) as DatabaseItem

    switch (item.type) {
      case "USER":
        /* if (record.eventName === "INSERT") */
        /*   await handleUserAdded(analytics, item as DatabaseUser) */
        /* if (record.eventName === "MODIFY") */
        /*   await handleUserUpdated( */
        /*     analytics, */
        /*     item as DatabaseUser, */
        /*     oldItem as DatabaseUser */
        /*   ) */
        break

      default:
        break
    }
  }

  /* await analytics.flush() */
}
