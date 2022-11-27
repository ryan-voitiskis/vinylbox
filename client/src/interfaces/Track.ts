interface KeyFinal {
  key: number
  mode: number
  keyString: string
  camelotString: string
  colour: string
}

interface HarmonyScore {
  closeness: number
  combination: number // the index of keyCombinations array
}

interface Track {
  _id: string
  spotifyID?: string
  title: string
  artists?: string // * optional to allow for artists to be inferred from record artists
  position?: string
  duration?: number | null
  bpm?: number
  rpm: number
  key?: number
  mode?: number
  genre?: string
  timeSignatureUpper?: number | null
  timeSignatureLower?: number | null
  playable: boolean
  audioFeatures?: {
    acousticness: number
    danceability: number
    duration_ms: number
    energy: number
    instrumentalness: number
    key: number
    liveness: number
    loudness: number
    mode: number
    speechiness: number
    tempo: number
    time_signature: number
    valence: number
  }
}

interface TrackPlus extends Track {
  recordID: string
  cover: string
  label: string
  year: number
  catno: string
  bpmFinal?: number
  artistsFinal: string
  durationFinal?: number
  keyFinal: KeyFinal | null
  timeSignature: number[] | null
}

interface TrackScored extends TrackPlus {
  score: HarmonyScore
}

export { KeyFinal, HarmonyScore, Track, TrackPlus, TrackScored }
