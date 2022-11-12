import { TrackPlus } from "@/interfaces/Track"
import { defineStore } from "pinia"
import { trackStore } from "@/stores/trackStore"

interface Deck {
  loadedTrack: TrackPlus | null
  playing: boolean
  rpm: number
  pitch: number // range of -100 (-8% of rpm) to 100 (+8% of rpm)
  tappedBpm: number | null
}
export const sessionStore = defineStore("session", {
  state: () => ({
    decks: [
      {
        loadedTrack: null,
        playing: false,
        rpm: 33,
        pitch: 0,
        tappedBpm: null,
      },
      {
        loadedTrack: null,
        playing: false,
        rpm: 33,
        pitch: 0,
        tappedBpm: null,
      },
    ] as Deck[],
    loadTrackTo: -1, // deck number to load track to
  }),
  actions: {
    loadTrack(_id: string) {
      this.decks[this.loadTrackTo].loadedTrack =
        trackStore().getTrackByIdFromCrateTrackList(_id)
    },
  },
  getters: {},
})
