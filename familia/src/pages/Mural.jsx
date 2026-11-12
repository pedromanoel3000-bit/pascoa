import { list, useStore } from '../store.js'
import { Empty, PageHeader } from '../ui.jsx'
import { Composer, Post } from './Home.jsx'

// Tela do mural: todos os recados, fotos e votações, inteiros.
export default function Mural() {
  const st = useStore()
  const posts = list(st, 'post').sort((a, b) => b.createdAt - a.createdAt)
  return (
    <div className="page">
      <PageHeader title="Mural da família" />
      <Composer />
      {posts.length === 0 && <Empty icon="📌" text="O mural está vazio. Escreva um recado ou poste uma foto para a família." />}
      {posts.map((p) => (
        <Post key={p.id} post={p} />
      ))}
    </div>
  )
}
