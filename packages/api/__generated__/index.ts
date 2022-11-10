export type Maybe<T> = T | null | undefined
export type InputMaybe<T> = T | null | undefined
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K]
}
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>
}
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>
}
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string
  String: string
  Boolean: boolean
  Int: number
  Float: number
  AWSDate: string
  AWSDateTime: string
  AWSEmail: string
  AWSIPAddress: string
  AWSJSON: string
  AWSPhone: string
  AWSTime: string
  AWSTimestamp: number
  AWSURL: string
}

export type Beet = IBeet & {
  __typename?: "Beet"
  createdAt: Scalars["AWSDateTime"]
  id: Scalars["ID"]
  liked: Scalars["Boolean"]
  likes: Scalars["Int"]
  profile?: Maybe<IProfile>
  rebeeted: Scalars["Boolean"]
  rebeets: Scalars["Int"]
  replies: Scalars["Int"]
  text: Scalars["String"]
}

export type BeetsPage = {
  __typename?: "BeetsPage"
  beets?: Maybe<Array<IBeet>>
  nextToken?: Maybe<Scalars["String"]>
}

export type IBeet = {
  createdAt: Scalars["AWSDateTime"]
  id: Scalars["ID"]
  profile?: Maybe<IProfile>
}

export type IProfile = {
  backgroundImageUrl?: Maybe<Scalars["AWSURL"]>
  beets: BeetsPage
  beetsCount: Scalars["Int"]
  bio?: Maybe<Scalars["String"]>
  birthdate?: Maybe<Scalars["AWSDate"]>
  createdAt: Scalars["AWSDateTime"]
  followerCount: Scalars["Int"]
  followingCount: Scalars["Int"]
  handle: Scalars["String"]
  id: Scalars["ID"]
  imageUrl?: Maybe<Scalars["AWSURL"]>
  location?: Maybe<Scalars["String"]>
  name: Scalars["String"]
  website?: Maybe<Scalars["AWSURL"]>
}

export type Mutation = {
  __typename?: "Mutation"
  beet: Scalars["Boolean"]
  follow: Scalars["Boolean"]
  like: Scalars["Boolean"]
  rebeet: Rebeet
  reply: Reply
  unfollow: Scalars["Boolean"]
  unlike: Scalars["Boolean"]
  unrebeet: Scalars["Boolean"]
}

export type MutationBeetArgs = {
  text: Scalars["String"]
}

export type MutationFollowArgs = {
  userId: Scalars["ID"]
}

export type MutationLikeArgs = {
  beetId: Scalars["ID"]
}

export type MutationRebeetArgs = {
  beetId: Scalars["ID"]
}

export type MutationReplyArgs = {
  beetId: Scalars["ID"]
  text: Scalars["String"]
}

export type MutationUnfollowArgs = {
  userId: Scalars["ID"]
}

export type MutationUnlikeArgs = {
  beetId: Scalars["ID"]
}

export type MutationUnrebeetArgs = {
  beetId: Scalars["ID"]
}

export type MyProfile = IProfile & {
  __typename?: "MyProfile"
  backgroundImageUrl?: Maybe<Scalars["AWSURL"]>
  beets: BeetsPage
  beetsCount: Scalars["Int"]
  bio?: Maybe<Scalars["String"]>
  birthdate?: Maybe<Scalars["AWSDate"]>
  createdAt: Scalars["AWSDateTime"]
  followerCount: Scalars["Int"]
  followingCount: Scalars["Int"]
  handle: Scalars["String"]
  id: Scalars["ID"]
  imageUrl?: Maybe<Scalars["AWSURL"]>
  location?: Maybe<Scalars["String"]>
  name: Scalars["String"]
  website?: Maybe<Scalars["AWSURL"]>
}

export type OtherProfile = IProfile & {
  __typename?: "OtherProfile"
  backgroundImageUrl?: Maybe<Scalars["AWSURL"]>
  beets: BeetsPage
  beetsCount: Scalars["Int"]
  bio?: Maybe<Scalars["String"]>
  birthdate?: Maybe<Scalars["AWSDate"]>
  createdAt: Scalars["AWSDateTime"]
  followedBy: Scalars["Boolean"]
  followerCount: Scalars["Int"]
  following: Scalars["Boolean"]
  followingCount: Scalars["Int"]
  handle: Scalars["String"]
  id: Scalars["ID"]
  imageUrl?: Maybe<Scalars["AWSURL"]>
  location?: Maybe<Scalars["String"]>
  name: Scalars["String"]
  website?: Maybe<Scalars["AWSURL"]>
}

export type ProfileInput = {
  backgroundImageUrl?: InputMaybe<Scalars["AWSURL"]>
  bio?: InputMaybe<Scalars["String"]>
  birthdate?: InputMaybe<Scalars["AWSDate"]>
  handle: Scalars["String"]
  id: Scalars["ID"]
  imageUrl?: InputMaybe<Scalars["AWSURL"]>
  location?: InputMaybe<Scalars["String"]>
  name: Scalars["String"]
  website?: InputMaybe<Scalars["AWSURL"]>
}

export type Query = {
  __typename?: "Query"
  getBeets: BeetsPage
  getLikes: UnhydratedBeetsPage
  getMyProfile: MyProfile
  getProfile?: Maybe<OtherProfile>
}

export type QueryGetBeetsArgs = {
  limit: Scalars["Int"]
  nextToken?: InputMaybe<Scalars["String"]>
  userId: Scalars["ID"]
}

export type QueryGetLikesArgs = {
  limit: Scalars["Int"]
  nextToken?: InputMaybe<Scalars["String"]>
  userId: Scalars["ID"]
}

export type QueryGetProfileArgs = {
  handle: Scalars["String"]
}

export type Rebeet = IBeet & {
  __typename?: "Rebeet"
  createdAt: Scalars["AWSDateTime"]
  id: Scalars["ID"]
  profile?: Maybe<IProfile>
  rebeetOf: IBeet
}

export type Reply = IBeet & {
  __typename?: "Reply"
  createdAt: Scalars["AWSDateTime"]
  id: Scalars["ID"]
  inReplyToBeet: IBeet
  inReplyToUsers?: Maybe<Array<IProfile>>
  liked: Scalars["Boolean"]
  likes: Scalars["Int"]
  profile?: Maybe<IProfile>
  rebeeted: Scalars["Boolean"]
  rebeets: Scalars["Int"]
  replies: Scalars["Int"]
  text: Scalars["String"]
}

export type UnhydratedBeetsPage = {
  __typename?: "UnhydratedBeetsPage"
  beets?: Maybe<Array<IBeet>>
  nextToken?: Maybe<Scalars["String"]>
}
