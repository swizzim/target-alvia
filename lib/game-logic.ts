import { v4 as uuidv4 } from 'uuid'

export interface Player {
  id: string
  name: string
  is_alive: boolean
  target_id?: string
}

export interface GameState {
  players: Player[]
  phase: 'waiting' | 'active' | 'finished'
  winner_id?: string
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function assignTargets(players: Player[]): Player[] {
  if (players.length < 2) return players

  const shuffled = shuffleArray(players)
  const targets: { [key: string]: string } = {}

  // Create circular assignment
  for (let i = 0; i < shuffled.length; i++) {
    const next = (i + 1) % shuffled.length
    targets[shuffled[i].id] = shuffled[next].id
  }

  // Update players with targets
  return players.map(player => ({
    ...player,
    target_id: targets[player.id]
  }))
}

export function eliminateTarget(gameState: GameState, eliminatorId: string): GameState {
  const eliminator = gameState.players.find(p => p.id === eliminatorId)
  if (!eliminator || !eliminator.target_id) {
    throw new Error('Invalid eliminator or no target assigned')
  }

  const target = gameState.players.find(p => p.id === eliminator.target_id)
  if (!target || !target.is_alive) {
    throw new Error('Target not found or already eliminated')
  }

  // Mark target as eliminated
  const updatedPlayers = gameState.players.map(player => {
    if (player.id === target.id) {
      return { ...player, is_alive: false }
    }
    if (player.id === eliminatorId) {
      // Eliminator inherits target's target
      return { ...player, target_id: target.target_id }
    }
    return player
  })

  const alivePlayers = updatedPlayers.filter(p => p.is_alive)
  
  // Check for winner
  if (alivePlayers.length === 1) {
    return {
      ...gameState,
      players: updatedPlayers,
      phase: 'finished',
      winner_id: alivePlayers[0].id
    }
  }

  return {
    ...gameState,
    players: updatedPlayers
  }
}

export function generateLobbyCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}
