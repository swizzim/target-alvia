'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { eliminateTarget } from '@/lib/game-logic'
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
  const [item, setItem] = useState('')
  const [location, setLocation] = useState('')
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

  const handleElimination = async () => {
    if (!currentPlayer || !selectedPlayer || !item.trim() || !location.trim()) {
      setError('Please fill in all fields')
      return
    }

    const eliminator = players.find(p => p.id === selectedPlayer)
    if (!eliminator || !eliminator.is_alive) {
      setError('Invalid player selected')
      return
    }

    if (!eliminator.target_id) {
      setError('No target assigned to this player')
      return
    }

    const target = players.find(p => p.id === eliminator.target_id)
    if (!target || !target.is_alive) {
      setError('Target is already eliminated')
      return
    }

    setIsEliminating(true)
    setError('')

    try {
      // Mark target as eliminated
      const supabase = getSupabase()
      await supabase
        .from('players')
        .update({ is_alive: false })
        .eq('id', target.id)

      // Update eliminator's target
      await supabase
        .from('players')
        .update({ target_id: target.target_id })
        .eq('id', eliminator.id)

      // Check if game is over
      const alivePlayers = players.filter(p => p.id !== target.id && p.is_alive)
      if (alivePlayers.length === 1) {
        // Game over - update lobby and game state
        await supabase
          .from('lobbies')
          .update({ status: 'finished' })
          .eq('id', lobby!.id)

        await supabase
          .from('game_states')
          .update({ 
            current_phase: 'finished',
            winner_id: alivePlayers[0].id
          })
          .eq('lobby_id', lobby!.id)

        // Show winner alert
        setTimeout(() => {
          alert(`🎉 ${alivePlayers[0].name} is the winner of Target: Alvia! 🎉`)
        }, 100)
      }

      // Clear form
      setItem('')
      setLocation('')
    } catch (err) {
      console.error('Error processing elimination:', err)
      setError('Failed to process elimination')
    } finally {
      setIsEliminating(false)
    }
  }

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

  const alivePlayers = players.filter(p => p.is_alive)
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
            <div className="bg-success-50 border border-success-200 rounded-lg p-3">
              <p className="text-success-700 font-semibold text-gray-800">
                Players remaining: {alivePlayers.length}
              </p>
            </div>
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

          {/* Target Display */}
          {selectedPlayerData && targetPlayer && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-center font-semibold text-yellow-800">
                Your current target: {targetPlayer.name}
              </p>
            </div>
          )}

          {/* Elimination Form */}
          {selectedPlayerData && targetPlayer && (
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item:
                </label>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                  placeholder="Enter item for your target"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location:
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Enter location for your target"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 placeholder-gray-500"
                />
              </div>

              <button
                onClick={handleElimination}
                disabled={isEliminating || !item.trim() || !location.trim()}
                className="w-full bg-danger-500 text-white py-3 px-4 rounded-lg hover:bg-danger-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isEliminating ? 'Processing...' : 'I eliminated my target'}
              </button>
            </div>
          )}

          {/* Players Status */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Players Status
            </h2>
            <div className="space-y-2">
              {players.map((player) => {
                const isTarget = selectedPlayerData?.target_id === player.id
                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      player.is_alive
                        ? isTarget
                          ? 'bg-red-50 border-red-200'
                          : 'bg-gray-50 border-gray-200'
                        : 'bg-gray-100 border-gray-300 opacity-60'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">
                        {player.is_alive ? (isTarget ? '🎯' : '🟢') : '💀'}
                      </span>
                      <span className="font-medium text-gray-800">{player.name}</span>
                      {isTarget && selectedPlayerData && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                          Your Target
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {player.is_alive ? 'Alive' : 'Eliminated'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* No back to lobby while game is active */}
        </div>
      </div>
    </div>
  )
}
