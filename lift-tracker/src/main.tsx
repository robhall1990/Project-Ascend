import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { seedIfEmpty } from './db/db'
import './styles.css'

async function bootstrap() {
  await seedIfEmpty()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap()
