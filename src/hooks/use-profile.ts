import { useQuery } from "@tanstack/react-query"

const fetchProfile = async () => {
  const token = localStorage.getItem("token")
  const response = await fetch("/api/profile", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!response.ok) {
    throw new Error("Error al obtener perfil")
  }
  return response.json()
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
  })
}

