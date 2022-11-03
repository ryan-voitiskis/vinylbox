import { defineStore } from "pinia"
import { userStore } from "@/stores/userStore"
import { recordStore } from "@/stores/recordStore"
import { fetchEventSource } from "@microsoft/fetch-event-source"
import spotifyService from "@/services/spotifyService"
import { InexactAlbumMatch } from "@/interfaces/InexactAlbumMatch"
import { InexactTrackMatch } from "@/interfaces/InexactTrackMatch"
import MatchedTrack from "@/interfaces/MatchedTrack"
import Record from "@/interfaces/Record"

// todo: make global or do something better
const API_SSE_URL = "http://localhost:5001/api/spotify_sse/"

export const spotifyStore = defineStore("spotify", {
  state: () => ({
    importProgress: 0,
    errorMsg: "",
    loading: false,
    importProgressModal: false,
    albumMatchesModal: false,
    trackMatchesModal: false,
    completionModal: false,
    revokeSpotifyForm: false,
    inexactAlbumMatches: [] as InexactAlbumMatch[], // records attempted to be found on spotify w/o perfect match
    inexactTrackMatches: [] as InexactTrackMatch[],
  }),
  actions: {
    // call and handle request that begins spotify OAuth flow
    async authorisationRequest(): Promise<number | null> {
      const user = userStore()
      this.loading = true
      this.errorMsg = ""
      try {
        const response = await spotifyService.authorisationRequest(
          user.authd.token
        )
        // handle successful update
        if (response.status === 200) {
          const res = await response.json()
          window.location.href = res
        }
        // handle 400 status code. see spotifyController.ts
        else {
          const error = await response.json()
          this.errorMsg = error.message ? error.message : "Unexpected error"
          this.loading = false // not for 200 res as redirect takes time
        }
        return response.status

        // catch error, eg. NetworkError. console.error(error) to debug
      } catch (error) {
        this.errorMsg = "Unexpected error. Probably network error."
        this.loading = false
        return null
      }
    },

    // call and handle response to request that removes spotifyToken, spotifyTokenSecret,
    // spotifyRequestToken and spotifyRequestTokenSecret from user.
    async revokeAuthorisation(): Promise<number | null> {
      const user = userStore()
      this.loading = true
      this.errorMsg = ""
      try {
        const response = await spotifyService.revokeAuthorisation(
          user.authd.token
        )
        // handle successful update
        if (response.status === 200) {
          user.authd.isSpotifyOAuthd = false
          this.revokeSpotifyForm = false
        }
        // handle 400 and 401 status codes. see userController.ts
        else {
          const error = await response.json()
          this.errorMsg = error.message ? error.message : "Unexpected error"
        }
        this.loading = false
        return response.status

        // catch error, eg. NetworkError. console.error(error) to debug
      } catch (error) {
        this.errorMsg = "Unexpected error. Probably network error."
        this.loading = false
        return null
      }
    },

    // gets and saves tracks audio features for manually added spotifyID
    async getTrackFeatures(track: MatchedTrack): Promise<number | null> {
      const user = userStore()
      this.errorMsg = ""
      try {
        const response = await spotifyService.getTrackFeatures(
          track,
          user.authd.token
        )
        // handle successful update
        if (response.status === 200) return response.status
        // handle 400 and 401 status codes. see userController.ts
        else {
          const error = await response.json()
          this.errorMsg = error.message ? error.message : "Unexpected error"
        }
        this.loading = false
        return response.status

        // catch error, eg. NetworkError. console.error(error) to debug
      } catch (error) {
        this.errorMsg = "Unexpected error. Probably network error."
        this.loading = false
        return null
      }
    },

    async importDataForSelectedRecords(token: string) {
      this.errorMsg = ""
      this.importProgressModal = true
      this.inexactAlbumMatches = []
      this.inexactTrackMatches = []
      const records = recordStore()
      const body = new URLSearchParams()
      body.append("records", JSON.stringify(records.checkboxed))

      const setProgress = (progress: number) => (this.importProgress = progress)

      const handleError = (msg: string) =>
        (this.errorMsg = msg ? msg.replace("Error: ", "") : "Unexpected error")

      const handleJSON = (data: string) => {
        this.importProgress = 1
        records.checkboxed = []
        this.importProgressModal = false // see note #1 at end of file
        const receivedObj = JSON.parse(data.substring(data.indexOf(":") + 1))
        this.inexactAlbumMatches = receivedObj.inexactAlbumMatches
        this.inexactTrackMatches = receivedObj.inexactTrackMatches
        if (this.inexactAlbumMatches.length) this.albumMatchesModal = true
        else if (this.inexactTrackMatches.length) this.trackMatchesModal = true
        this.importProgress = 0
      }

      const handleCompletion = async () => {
        this.loading = true
        records.checkboxed = []
        await records.fetchRecords(token)
        this.importProgressModal = false
        this.importProgress = 0
        this.loading = false
        this.completionModal = true
      }

      if (records.checkboxed.length) {
        try {
          // fetch SSE request made directly from Store so importProgress can be mutated.
          // spotifyStore cannot be accessed from spotifyService
          await fetchEventSource(API_SSE_URL + "import_selected", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Bearer ${token}`,
            },
            body: body,
            onmessage(msg) {
              if (msg.data.startsWith("Error")) handleError(msg.data)
              else if (msg.data.startsWith("json")) handleJSON(msg.data)
              else {
                const progress = parseFloat(msg.data)
                setProgress(progress)
                if (progress === 1) handleCompletion()
              }
            },
            onerror(err) {
              console.error(err)
              handleError(err)
            },
          })
        } catch (error) {
          console.error(error)
        }
      } else {
        this.importProgressModal = false
      }
    },

    async importSelectedInexactMatches(token: string) {
      this.albumMatchesModal = false
      this.trackMatchesModal = false
      this.errorMsg = ""
      this.importProgressModal = true
      const records = recordStore()
      const body = new URLSearchParams()
      const matchedAlbums = this.getMatchedInexactAlbums()
      const matchedTracks = this.getMatchedInexactTracks()
      const unmatchedAlbums = this.getUnmatchedInexactAlbums()
      body.append("matchedAlbums", JSON.stringify(matchedAlbums))
      body.append("matchedTracks", JSON.stringify(matchedTracks))
      body.append("unmatchedAlbums", JSON.stringify(unmatchedAlbums))
      this.inexactAlbumMatches = []
      this.inexactTrackMatches = []

      const setProgress = (progress: number) => (this.importProgress = progress)

      const handleError = (msg: string) =>
        (this.errorMsg = msg ? msg.replace("Error: ", "") : "Unexpected error")

      const handleJSON = (data: string) => {
        this.importProgress = 1
        records.checkboxed = []
        this.importProgressModal = false // see note #2 at end of file
        const receivedObj = JSON.parse(data.substring(data.indexOf(":") + 1))
        this.inexactTrackMatches = receivedObj.inexactTrackMatches
        if (this.inexactTrackMatches.length) this.trackMatchesModal = true
        this.importProgress = 0
      }

      const handleCompletion = async () => {
        this.loading = true
        records.checkboxed = []
        await records.fetchRecords(token)
        this.importProgressModal = false
        this.importProgress = 0
        this.loading = false
        this.completionModal = true
      }

      try {
        // fetch SSE request made directly from Store so importProgress can be mutated.
        // spotifyStore cannot be accessed from spotifyService
        await fetchEventSource(API_SSE_URL + "import_matched", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Bearer ${token}`,
          },
          body: body,
          onmessage(msg) {
            if (msg.data.startsWith("Error")) handleError(msg.data)
            else if (msg.data.startsWith("json")) handleJSON(msg.data)
            else {
              const progress = parseFloat(msg.data)
              setProgress(progress)
              if (progress === 1) handleCompletion()
            }
          },
          onerror(err) {
            console.error(err)
            handleError(err)
          },
        })
      } catch (error) {
        console.error(error)
      }
    },

    // selects or deselects InexactMatchesOption. if selecting, also deselects all other options
    // works like radio buttons but can also deselect, so that none are selected
    toggleInexactAlbumOption(recordID: string, optionID: string) {
      const inexactMatch = this.inexactAlbumMatches.find(
        (i) => i.recordID === recordID
      )
      if (inexactMatch) {
        const inexactMatchOption = inexactMatch.matches.find(
          (i) => i.id === optionID
        )
        if (inexactMatchOption) {
          if (!inexactMatchOption.selected) {
            inexactMatch.matches.forEach((i) => {
              i.selected = false
            })
            inexactMatchOption.selected = !inexactMatchOption.selected
          } else
            inexactMatch.matches.forEach((i) => {
              i.selected = false
            })
        }
      }
    },

    toggleInexactTrackOption(trackID: string, optionID: string) {
      const inexactMatch = this.inexactTrackMatches.find(
        (i) => i.trackID === trackID
      )
      if (inexactMatch) {
        const inexactMatchOption = inexactMatch.options.find(
          (i) => i.id === optionID
        )
        if (inexactMatchOption) {
          if (!inexactMatchOption.selected) {
            inexactMatch.options.forEach((i) => {
              i.selected = false
            })
            inexactMatchOption.selected = !inexactMatchOption.selected
          } else
            inexactMatch.options.forEach((i) => {
              i.selected = false
            })
        }
      }
    },
  },

  getters: {
    // creates an array of the selected record IDs and corresponding spotify album IDs
    getMatchedInexactAlbums: (state) => {
      return () =>
        state.inexactAlbumMatches
          .filter((i) => i.matches.find((i) => i.selected))
          .map((i) => ({
            recordID: i.recordID,
            album: i.matches.find((i) => i.selected),
          }))
    },
    // creates an array of the Unselected record IDs and corresponding spotify album IDs
    getUnmatchedInexactAlbums: (state) => {
      return () =>
        state.inexactAlbumMatches
          .filter((i) => !i.matches.find((i) => i.selected))
          .map((i) => i.recordID)
    },
    // creates an array of the selected track spotify track IDs with corresponding record and track _id
    getMatchedInexactTracks: (state) => {
      return () =>
        state.inexactTrackMatches
          .filter((i) => i.options.find((i) => i.selected))
          .map((i) => ({
            recordID: i.recordID,
            trackID: i.trackID,
            spotifyTrackID: i.options.find((i) => i.selected)?.id,
          }))
    },
  },
})

// NOTES
// #1 importProgressModal must be closed before inexactAlbumMatches !== [], so document.body.style.overflow = "hidden" from ModalBox hook
// #2 importProgressModal must be closed before inexactTrackMatches !== [], so document.body.style.overflow = "hidden" from ModalBox hook
