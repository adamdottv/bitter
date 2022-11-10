export type ItemType = "PROFILE" | "HANDLE"

export interface DatabaseItem {
  pk: string
  sk: string
  type: ItemType
  created: string
  gsi1pk?: string
  gsi1sk?: string
}
