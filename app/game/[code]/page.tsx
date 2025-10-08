'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import type { Lobby, Player, GameState } from '@/lib/supabase'

export default function GamePage() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string

  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEliminating, setIsEliminating] = useState(false)

  useEffect(() => {
    if (!code) return

    const fetchGameData = async () => {
      try {
        // Fetch lobby
        const supabase = getSupabase()
        const { data: lobbyData, error: lobbyError } = await supabase
          .from('lobbies')
          .select('*')
          .eq('code', code)
          .single()

        if (lobbyError) throw lobbyError
        setLobby(lobbyData)

        // Fetch players
        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('*')
          .eq('lobby_id', lobbyData.id)
          .order('created_at')

        if (playersError) throw playersError
        setPlayers(playersData)

        // Fetch game state
        const { data: gameData, error: gameError } = await supabase
          .from('game_states')
          .select('*')
          .eq('lobby_id', lobbyData.id)
          .single()

        if (gameError) throw gameError
        setGameState(gameData)

        // Identify current player from localStorage set at join/create time
        let storedId: string | null = null
        try { storedId = localStorage.getItem('playerId') } catch {}

        const me = storedId
          ? playersData.find(p => p.id === storedId)
          : undefined

        const fallback = playersData.find(p => p.is_alive)
        const activePlayer = me || fallback || null
        if (activePlayer) {
          setCurrentPlayer(activePlayer)
          setSelectedPlayer(activePlayer.id)
        }
      } catch (err) {
        console.error('Error fetching game data:', err)
        setError('Failed to load game data')
      } finally {
        setLoading(false)
      }
    }

    fetchGameData()

    // Set up real-time subscriptions
    const supabaseRt = getSupabase()
    const gameSubscription = supabaseRt
      .channel(`game-${code}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'lobbies', filter: `code=eq.${code}` },
        (payload) => {
          setLobby(payload.new as Lobby)
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `lobby_id=eq.${lobby?.id}` },
        () => {
          // Refetch players when they change
          fetchGameData()
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'game_states', filter: `lobby_id=eq.${lobby?.id}` },
        (payload) => {
          setGameState(payload.new as GameState)
        }
      )
      .subscribe()

    return () => {
      gameSubscription.unsubscribe()
    }
  }, [code, lobby?.id])

  // Elimination and items removed per simplified spec

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading game...</p>
        </div>
      </div>
    )
  }

  if (error && !lobby) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-danger-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  if (!lobby || !gameState || lobby.status !== 'active') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Game not active</p>
          <button
            onClick={() => router.push(`/lobby/${code}`)}
            className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    )
  }

  const selectedPlayerData = players.find(p => p.id === selectedPlayer)
  const targetPlayer = selectedPlayerData?.target_id 
    ? players.find(p => p.id === selectedPlayerData.target_id)
    : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-primary-700 mb-2">
              🎯 Game: {code}
            </h1>
            {/* Removed players remaining count */}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
              {error}
            </div>
          )}

          {/* Player identity display (no switching) */}
          {currentPlayer && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                You are:
              </label>
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800">
                {currentPlayer.name}
              </div>
            </div>
          )}

          {/* Target Display (read-only) */}
          {selectedPlayerData && targetPlayer && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-center font-semibold text-yellow-800">
                Your target: {targetPlayer.name}
              </p>
            </div>
          )}

          {/* Elimination UI removed */}

          {/* Players status list removed */}

          {/* No back to lobby while game is active */}
        </div>
      </div>
    </div>
  )
}
