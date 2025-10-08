'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { generateLobbyCode } from '@/lib/game-logic'

export default function Home() {
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [lobbyCode, setLobbyCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const createLobby = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name')
      return
    }

    setIsCreating(true)
    setError('')

    try {
      const code = generateLobbyCode()
      const hostId = crypto.randomUUID()

      // Create lobby
      const { data: lobby, error: lobbyError } = await supabase
        .from('lobbies')
        .insert({
          code,
          host_id: hostId,
          status: 'waiting'
        })
        .select()
        .single()

      if (lobbyError) throw lobbyError

      // Add host as first player
      const { error: playerError } = await supabase
        .from('players')
        .insert({
          id: hostId,
          lobby_id: lobby.id,
          name: playerName.trim(),
          is_host: true,
          is_alive: true
        })

      if (playerError) throw playerError

      // Create initial game state
      const { error: gameError } = await supabase
        .from('game_states')
        .insert({
          lobby_id: lobby.id,
          current_phase: 'waiting'
        })

      if (gameError) throw gameError

      // Persist identity for this device/session
      try {
        localStorage.setItem('playerId', hostId)
        localStorage.setItem('lobbyCode', code)
      } catch {}

      router.push(`/lobby/${code}`)
    } catch (err) {
      console.error('Error creating lobby:', err)
      setError('Failed to create lobby. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  const joinLobby = async () => {
    if (!lobbyCode.trim() || !playerName.trim()) {
      setError('Please enter both lobby code and your name')
      return
    }

    setIsJoining(true)
    setError('')

    try {
      // Check if lobby exists
      const { data: lobby, error: lobbyError } = await supabase
        .from('lobbies')
        .select('*')
        .eq('code', lobbyCode.toUpperCase())
        .eq('status', 'waiting')
        .single()

      if (lobbyError) {
        if (lobbyError.code === 'PGRST116') {
          throw new Error('Lobby not found or game already started')
        }
        throw lobbyError
      }

      // Check if player name is already taken in this lobby
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('name')
        .eq('lobby_id', lobby.id)
        .eq('name', playerName.trim())
        .single()

      if (existingPlayer) {
        throw new Error('Name already taken in this lobby')
      }

      // Add player to lobby
      const playerId = crypto.randomUUID()
      const { error: playerError } = await supabase
        .from('players')
        .insert({
          id: playerId,
          lobby_id: lobby.id,
          name: playerName.trim(),
          is_host: false,
          is_alive: true
        })

      if (playerError) throw playerError

      // Persist identity for this device/session
      try {
        localStorage.setItem('playerId', playerId)
        localStorage.setItem('lobbyCode', lobbyCode.toUpperCase())
      } catch {}

      router.push(`/lobby/${lobbyCode.toUpperCase()}`)
    } catch (err: any) {
      console.error('Error joining lobby:', err)
      setError(err.message || 'Failed to join lobby. Please try again.')
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-700 mb-2">
            🎯 Target: Alvia
          </h1>
          <p className="text-gray-600">
            The ultimate elimination game
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
            {error}
          </div>
        )}

        {/* Global Name Field */}
        <div className="mb-6 border border-gray-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Your Player Name
          </h2>
          <input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 placeholder-gray-500"
            disabled={isCreating || isJoining}
          />
        </div>

        <div className="space-y-6">
          {/* Create Lobby */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Create New Game
            </h2>
            <div className="space-y-3">
              <button
                onClick={createLobby}
                disabled={isCreating || isJoining || !playerName.trim()}
                className="w-full bg-primary-500 text-white py-2 px-4 rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isCreating ? 'Creating...' : 'Create Lobby'}
              </button>
            </div>
          </div>

          {/* Join Lobby */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Join Existing Game
            </h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Lobby code"
                value={lobbyCode}
                onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 placeholder-gray-500"
                disabled={isCreating || isJoining}
                maxLength={6}
              />
              <button
                onClick={joinLobby}
                disabled={isCreating || isJoining || !playerName.trim()}
                className="w-full bg-success-500 text-white py-2 px-4 rounded-lg hover:bg-success-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isJoining ? 'Joining...' : 'Join Lobby'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Share the lobby code with friends to play together!</p>
        </div>
      </div>
    </div>
  )
}
