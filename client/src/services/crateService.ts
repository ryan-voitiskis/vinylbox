import Crate from "@/interfaces/Crate"
const API_URL = "http://localhost:5000/api/crates"

// add new crate
const addCrate = async (crate: Crate, token: string) => {
  const body = new URLSearchParams()
  body.append("name", crate.name)
  body.append("user", crate.user)

  const options = {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${token}`,
    },
    body: body,
  }
  const response = await fetch(API_URL, options)
  return response
}

// Get user crates
const getCrates = async (token: string) => {
  const options = {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${token}`,
    },
  }
  const response = await fetch(API_URL, options)
  return response
}

// Delete user crate
const deleteCrate = async (id: string, token: string) => {
  const options = {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${token}`,
    },
  }
  const response = await fetch(API_URL + "/" + id, options)
  return response
}

const crateService = {
  addCrate,
  getCrates,
  deleteCrate,
}
export default crateService