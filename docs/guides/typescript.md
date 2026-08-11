# 📘 TypeScript Patterns - Pruebas María 2.0

Patrones y mejores prácticas de TypeScript en el proyecto.

---

## 🎯 Básicos

### Tipos Simples

```typescript
// Primitivos
let nombre: string = 'Alexis'
let edad: number = 25
let activo: boolean = true
let datos: unknown = { foo: 'bar' }
let nada: null = null

// Arrays
let numeros: number[] = [1, 2, 3]
let strings: Array<string> = ['a', 'b']
let mixto: (string | number)[] = [1, 'dos', 3]

// Any (evita)
let cualquier: any = {}  // ❌ Pierde type safety
```

---

## 🧩 Interfaces

### Interfaz Simple

```typescript
interface Usuario {
  id: string
  nombre: string
  email: string
  activo: boolean
}

const usuario: Usuario = {
  id: '1',
  nombre: 'Alexis',
  email: 'alexis@example.com',
  activo: true,
}
```

### Propiedades Opcionales

```typescript
interface Usuario {
  id: string
  nombre: string
  email?: string        // Opcional
  telefono?: string
  readonly createdAt: Date  // Solo lectura
}
```

### Extender Interfaces

```typescript
interface Usuario {
  id: string
  nombre: string
}

interface Admin extends Usuario {
  permisos: string[]
  nivel: 'basico' | 'avanzado' | 'super'
}

const admin: Admin = {
  id: '1',
  nombre: 'Admin',
  permisos: ['crear', 'editar'],
  nivel: 'super',
}
```

---

## 🔧 Tipos de React

### Props de Componente

```typescript
import React, { FC, ReactNode } from 'react'

// Opción 1: Interface
interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}

export function Button(props: ButtonProps) {
  return <button>{props.children}</button>
}

// Opción 2: Type
type ButtonProps = {
  children: ReactNode
  onClick?: () => void
}

// Opción 3: Extender HTML
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

export function Button({ variant, ...props }: ButtonProps) {
  return <button {...props} />
}
```

### Hooks Tipados

```typescript
import { useState, useCallback, useRef } from 'react'

// useState
const [count, setCount] = useState<number>(0)
const [name, setName] = useState<string>('')

// useCallback
const handleClick = useCallback((id: string) => {
  console.log(id)
}, [])

// useRef
const inputRef = useRef<HTMLInputElement>(null)

// useEffect
useEffect(() => {
  // ...
}, [dependency])
```

---

## 🎨 Tipos Union e Intersection

### Union Types

```typescript
type Status = 'pending' | 'loading' | 'success' | 'error'
type ID = string | number
type Result = string | Error

function processStatus(status: Status) {
  if (status === 'success') {
    // TypeScript sabe que es success
  }
}
```

### Intersection Types

```typescript
interface Usuario {
  id: string
  nombre: string
}

interface Timestamp {
  createdAt: Date
  updatedAt: Date
}

type UsuarioConTimestamp = Usuario & Timestamp

const usuario: UsuarioConTimestamp = {
  id: '1',
  nombre: 'Alexis',
  createdAt: new Date(),
  updatedAt: new Date(),
}
```

---

## 🎯 Type Guards

### Type Guard Básico

```typescript
function isSring(value: unknown): value is string {
  return typeof value === 'string'
}

function procesarValor(valor: string | number) {
  if (isString(valor)) {
    // TypeScript sabe que es string
    console.log(valor.toUpperCase())
  } else {
    // TypeScript sabe que es number
    console.log(valor.toFixed(2))
  }
}
```

### Discriminated Union

```typescript
type Respuesta = 
  | { estado: 'success'; datos: unknown }
  | { estado: 'error'; mensaje: string }

function handleRespuesta(r: Respuesta) {
  if (r.estado === 'success') {
    console.log(r.datos)  // datos está disponible
  } else {
    console.log(r.mensaje)  // mensaje está disponible
  }
}
```

---

## 🎓 Generics

### Generic Simple

```typescript
function obtenerPrimero<T>(items: T[]): T {
  return items[0]
}

const numeros = obtenerPrimero([1, 2, 3])  // number
const strings = obtenerPrimero(['a', 'b'])  // string
```

### Generic con Constraints

```typescript
interface ConId {
  id: string
}

function processItem<T extends ConId>(item: T): string {
  return item.id  // TypeScript sabe que id existe
}

processItem({ id: '1', nombre: 'Alexis' })  // ✅
processItem({ nombre: 'Alexis' })  // ❌ Error - falta id
```

### Generic en Componentes

```typescript
interface ListProps<T> {
  items: T[]
  renderItem: (item: T) => ReactNode
}

function List<T extends { id: string }>(props: ListProps<T>) {
  return (
    <ul>
      {props.items.map(item => (
        <li key={item.id}>{props.renderItem(item)}</li>
      ))}
    </ul>
  )
}

// Uso
<List<Usuario>
  items={usuarios}
  renderItem={(u) => <span>{u.nombre}</span>}
/>
```

---

## 📦 Enums

### Enum Básico

```typescript
enum Status {
  Pending = 'pending',
  Loading = 'loading',
  Success = 'success',
  Error = 'error',
}

const estado: Status = Status.Success
```

### Evitar Enums (Moderna)

```typescript
// ✅ NUEVO - Usa const assertion
type Status = 'pending' | 'loading' | 'success' | 'error'

const statusValues = ['pending', 'loading', 'success', 'error'] as const
type Status = typeof statusValues[number]  // 'pending' | 'loading' | ...
```

---

## 🎯 Utility Types

### Partial - Todas las propiedades opcionales

```typescript
interface Usuario {
  id: string
  nombre: string
  email: string
}

type UsuarioPartial = Partial<Usuario>
// Es igual a:
// { id?: string; nombre?: string; email?: string }
```

### Omit - Excluir propiedades

```typescript
type UsuarioSinID = Omit<Usuario, 'id'>
// { nombre: string; email: string }
```

### Pick - Seleccionar propiedades

```typescript
type UsuarioBasico = Pick<Usuario, 'id' | 'nombre'>
// { id: string; nombre: string }
```

### Record - Mapeo de tipos

```typescript
type Permisos = 'crear' | 'editar' | 'eliminar'
type PermisosUsuario = Record<Permisos, boolean>

// Es igual a:
// {
//   crear: boolean
//   editar: boolean
//   eliminar: boolean
// }
```

### Readonly - Propiedades inmutables

```typescript
type UsuarioReadonly = Readonly<Usuario>
// No se puede modificar una vez creado

const user: UsuarioReadonly = { ... }
user.nombre = 'Nuevo'  // ❌ Error
```

---

## 🔄 Flujo de Tipos Común

```typescript
// 1. Definir interfaz de datos
interface Usuario {
  id: string
  nombre: string
  email: string
}

// 2. Definir interfaz de props
interface UsuarioCardProps {
  usuario: Usuario
  onDelete?: (id: string) => void
}

// 3. Crear componente tipado
function UsuarioCard({ usuario, onDelete }: UsuarioCardProps) {
  return (
    <div>
      <h2>{usuario.nombre}</h2>
      <p>{usuario.email}</p>
      <button onClick={() => onDelete?.(usuario.id)}>
        Eliminar
      </button>
    </div>
  )
}

// 4. Usar componente
<UsuarioCard
  usuario={{ id: '1', nombre: 'Alexis', email: 'alexis@ex.com' }}
  onDelete={(id) => console.log(id)}
/>
```

---

## 🚫 Errores Comunes

### Error: Tipo implícito Any

```typescript
// ❌ Error
function procesar(datos) {  // datos es any
  return datos.nombre  // Podría fallar en runtime
}

// ✅ Correcto
function procesar(datos: { nombre: string }) {
  return datos.nombre  // TypeScript verifica
}
```

### Error: Propiedad No Existe

```typescript
// ❌ Error
interface Usuario {
  nombre: string
}

const u: Usuario = {}  // Falta nombre
u.email = 'test@ex.com'  // Propiedad no existe en Usuario

// ✅ Correcto
interface Usuario {
  nombre: string
  email?: string
}

const u: Usuario = { nombre: 'Alexis' }
u.email = 'test@ex.com'  // ✅
```

### Error: Tipos Incompatibles

```typescript
// ❌ Error
const id: string = 123  // number no es string

// ✅ Correcto
const id: string = '123'
const numero: number = 123
```

---

## 🎯 Patrones en Pruebas María 2.0

### Componente Tipado

```typescript
// components/ui/reporte-card.tsx
import React, { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ReporteCardProps {
  titulo: string
  cantidad: number
  estado: 'completado' | 'pendiente' | 'cancelado'
  onClick?: (id: string) => void
  className?: string
}

export function ReporteCard({
  titulo,
  cantidad,
  estado,
  onClick,
  className,
}: ReporteCardProps) {
  const estadoColor = {
    completado: 'bg-green-100 text-green-800',
    pendiente: 'bg-yellow-100 text-yellow-800',
    cancelado: 'bg-red-100 text-red-800',
  }[estado]

  return (
    <div
      className={cn(
        'rounded-lg border p-4 cursor-pointer hover:shadow-lg',
        className
      )}
      onClick={() => onClick?.('123')}
    >
      <h3>{titulo}</h3>
      <p className="text-2xl font-bold">{cantidad}</p>
      <span className={`px-2 py-1 rounded-full text-sm ${estadoColor}`}>
        {estado}
      </span>
    </div>
  )
}
```

### Página con Parámetros Tipados

```typescript
// app/reporte/[ronda]/page.tsx
import { Metadata } from 'next'

interface RondaPageProps {
  params: {
    ronda: string
  }
}

export async function generateMetadata({
  params,
}: RondaPageProps): Promise<Metadata> {
  return {
    title: `Ronda ${params.ronda} - Pruebas María`,
  }
}

export default function RondaPage({ params }: RondaPageProps) {
  const rondaNumber = parseInt(params.ronda)
  
  return (
    <div>
      <h1>Ronda {rondaNumber}</h1>
      {/* Contenido */}
    </div>
  )
}
```

---

## ✅ Checklist

- [ ] Todos los parámetros de función tipados
- [ ] Interfaces para props de componentes
- [ ] Evito `any` y `unknown` sin necesidad
- [ ] Uso type guards para narrowing
- [ ] Sigo convenciones del proyecto
- [ ] TypeScript compila sin errores

---

## 📚 Recursos

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)

---

**Siguiente tema**: [`guide./deployment.md`](./deployment.md)
