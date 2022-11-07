export type ItemType = "USER" | "USERNAME"

export interface DatabaseItem {
  pk: string
  sk: string
  type: ItemType
  created: string
  gsi1pk?: string
  gsi1sk?: string
}
