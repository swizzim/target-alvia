'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { assignTargets } from '@/lib/game-logic'
import type { Lobby, Player, GameState } from '@/lib/supabase'

export default function LobbyPage() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string

  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!code) return

    const fetchLobbyData = async () => {
      try {
        // Fetch lobby
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

        // Set current player (you can implement user identification here)
        // For now, we'll use the first player as current
        if (playersData.length > 0) {
          setCurrentPlayer(playersData[0])
        }
      } catch (err) {
        console.error('Error fetching lobby data:', err)
        setError('Failed to load lobby data')
      } finally {
        setLoading(false)
      }
    }

    fetchLobbyData()

    // Set up real-time subscriptions
    const lobbySubscription = supabase
      .channel(`lobby-${code}`)
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
          fetchLobbyData()
        }
      )
      .subscribe()

    return () => {
      lobbySubscription.unsubscribe()
    }
  }, [code, lobby?.id])

  const startGame = async () => {
    if (!lobby || !currentPlayer || !currentPlayer.is_host) return

    try {
      // Assign targets
      const playersWithTargets = assignTargets(players)

      // Update players with targets
      for (const player of playersWithTargets) {
        if (player.target_id) {
          await supabase
            .from('players')
            .update({ target_id: player.target_id })
            .eq('id', player.id)
        }
      }

      // Update lobby and game state
      await supabase
        .from('lobbies')
        .update({ status: 'active' })
        .eq('id', lobby.id)

      await supabase
        .from('game_states')
        .update({ current_phase: 'active' })
        .eq('lobby_id', lobby.id)

      router.push(`/game/${code}`)
    } catch (err) {
      console.error('Error starting game:', err)
      setError('Failed to start game')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading lobby...</p>
        </div>
      </div>
    )
  }

  if (error || !lobby) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-danger-600 mb-4">{error || 'Lobby not found'}</p>
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

  const isHost = currentPlayer?.is_host
  const canStart = players.length >= 2 && lobby.status === 'waiting'

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-primary-700 mb-2">
              🎯 Lobby: {code}
            </h1>
            <p className="text-gray-600">
              {lobby.status === 'waiting' ? 'Waiting for players...' : 'Game in progress'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
              {error}
            </div>
          )}

          {/* Players List */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Players ({players.length})
            </h2>
            <div className="space-y-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    player.is_host
                      ? 'bg-primary-50 border-primary-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">
                      {player.is_host ? '👑' : '🎯'}
                    </span>
                    <span className="font-medium text-gray-800">{player.name}</span>
                    {player.is_host && (
                      <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                        Host
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {player.is_alive ? '🟢 Alive' : '🔴 Eliminated'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Game Controls */}
          {lobby.status === 'waiting' && (
            <div className="text-center">
              {isHost ? (
                <div className="space-y-4">
                  <p className="text-gray-600">
                    {players.length < 2
                      ? 'Need at least 2 players to start'
                      : 'Ready to start the game!'}
                  </p>
                  <button
                    onClick={startGame}
                    disabled={!canStart}
                    className="bg-success-500 text-white px-6 py-3 rounded-lg hover:bg-success-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    Start Game
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Waiting for host to start the game...
                  </p>
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-pulse w-2 h-2 bg-primary-500 rounded-full"></div>
                    <div className="animate-pulse w-2 h-2 bg-primary-500 rounded-full" style={{ animationDelay: '0.2s' }}></div>
                    <div className="animate-pulse w-2 h-2 bg-primary-500 rounded-full" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {lobby.status === 'active' && (
            <div className="text-center">
              <p className="text-gray-600 mb-4">Game is in progress!</p>
              <button
                onClick={() => router.push(`/game/${code}`)}
                className="bg-primary-500 text-white px-6 py-3 rounded-lg hover:bg-primary-600 transition-colors font-medium"
              >
                Enter Game
              </button>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-200 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
