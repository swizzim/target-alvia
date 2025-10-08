# 🎯 Target: Alvia - Assassination Game

A multiplayer elimination game where players hunt their targets in a circular chain until only one remains.

## Features

- **Lobby System**: Create or join games with unique codes
- **Real-time Updates**: Live synchronization across all players
- **Target Assignment**: Automatic circular target assignment
- **Elimination Tracking**: Real-time player status updates
- **Modern UI**: Beautiful, responsive design with Tailwind CSS

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel
- **Real-time**: Supabase Realtime

## Setup Instructions

### 1. Clone and Install

```bash
git clone <your-repo>
cd assassination-game
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Create the following tables in the SQL Editor:

```sql
-- Lobbies table
CREATE TABLE lobbies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  host_id UUID NOT NULL,
  status TEXT CHECK (status IN ('waiting', 'active', 'finished')) DEFAULT 'waiting',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Players table
CREATE TABLE players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_host BOOLEAN DEFAULT FALSE,
  is_alive BOOLEAN DEFAULT TRUE,
  target_id UUID REFERENCES players(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game states table
CREATE TABLE game_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE,
  current_phase TEXT CHECK (current_phase IN ('waiting', 'active', 'finished')) DEFAULT 'waiting',
  winner_id UUID REFERENCES players(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for simplicity - customize as needed)
CREATE POLICY "Allow all operations on lobbies" ON lobbies FOR ALL USING (true);
CREATE POLICY "Allow all operations on players" ON players FOR ALL USING (true);
CREATE POLICY "Allow all operations on game_states" ON game_states FOR ALL USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE lobbies;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE game_states;
```

### 3. Environment Variables

Create a `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy!

## How to Play

1. **Create/Join**: Create a new lobby or join with a code
2. **Wait for Players**: Host waits for at least 2 players
3. **Start Game**: Host clicks "Start Game" to begin
4. **Get Your Target**: Each player sees their assigned target
5. **Eliminate**: When you eliminate your target, you inherit their target
6. **Win**: Last player standing wins!

## Game Rules

- Each player has exactly one target
- When you eliminate your target, you get their target
- Players are eliminated in a circular chain
- Last player alive wins
- Real-time updates keep everyone synchronized

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use this for your own games!
