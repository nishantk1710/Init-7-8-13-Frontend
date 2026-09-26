/** One backend response as scripts/mock-data/record.mts saved it. */
export type RecordedResponse = {
  /** mockKey() of the request that produced it. */
  key: string
  status: number
  contentType: string
  /** Only the headers a caller reads (X-Total-Count, Content-Disposition). */
  headers: Record<string, string>
  /** Parsed JSON, or -- for a non-JSON body such as the Excel export -- base64. */
  body: unknown
  encoding?: "base64"
}
