import { Readable } from 'stream'
import streamifier from 'streamifier'

// ── Media ────────────────────────────────────────────────────────────────────

class Media {
  name: string
  buffer: Buffer

  constructor(params: { name: string; buffer: Buffer }) {
    this.name = params.name
    this.buffer = params.buffer
  }

  read(): Readable {
    return streamifier.createReadStream(this.buffer)
  }

  trash() {
    this.buffer = Buffer.alloc(0)
  }
}

export class MediaManager {
  entitiesMap: Record<string, Media> = {}

  addEntity(param: { name: string; buffer: Buffer }): boolean {
    const name = param.name.toLowerCase()
    if (this.entitiesMap[name]) return false
    this.entitiesMap[name] = new Media({ name, buffer: param.buffer })
    return true
  }

  getEntity(name: string): Media | undefined {
    return this.entitiesMap[name.toLowerCase()]
  }

  removeEntity(name: string) {
    const m = this.entitiesMap[name.toLowerCase()]
    if (m) { m.trash(); delete this.entitiesMap[name.toLowerCase()] }
  }

  stream(name: string): Readable | false {
    const m = this.getEntity(name)
    return m ? m.read() : false
  }
}

// ── Product ──────────────────────────────────────────────────────────────────

interface ProductParams {
  id?: number
  name: string
  brand?: string
  desc?: string
  categories?: string[]
  attributes?: Record<string, string[]>
  price?: number
  stock?: number
  cprice?: number
}

class Product {
  id: number
  name: string
  brand: string
  desc: string
  categories: string[]
  images: string[]
  attributes: Record<string, string[]>
  price: number
  cprice: number
  stock: number

  constructor(p: ProductParams & { id: number }) {
    this.id = p.id
    this.name = p.name.toLowerCase()
    this.brand = (p.brand ?? 'others').toLowerCase()
    this.desc = (p.desc ?? '').toLowerCase()
    this.categories = p.categories ?? []
    this.images = []
    this.attributes = p.attributes ?? {}
    this.price = p.price ?? 0
    this.cprice = p.cprice ?? p.price ?? 0
    this.stock = p.stock ?? 0
  }

  addImage(img: string) { this.images.push(img) }
  setPrice(p: number) { this.cprice = p }

  setkeys(params: Partial<ProductParams>) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && k !== 'id') (this as Record<string, unknown>)[k] = v
    }
  }
}

export class ProductManager {
  private entities: Product[] = []
  entitiesMap: Record<string, Product> = {}
  entitiesMapById: Record<number, Product> = {}

  addEntity(param: ProductParams): boolean {
    const id = this.entities.length ? this.entities[this.entities.length - 1].id + 1 : 1
    const name = (param.name ?? '').toLowerCase()
    if (this.entitiesMap[name]) return false
    const p = new Product({ ...param, id })
    this.entities.push(p)
    this.entitiesMap[p.name] = p
    this.entitiesMapById[p.id] = p
    return true
  }

  getEntityById(id: number): Product | undefined {
    return this.entitiesMapById[id]
  }

  getEntityByName(name: string): Product | undefined {
    return this.entitiesMap[name.toLowerCase()]
  }

  removeEntity(prop: number | string) {
    if (typeof prop === 'number') {
      const p = this.entitiesMapById[prop]
      if (p) { delete this.entitiesMap[p.name]; delete this.entitiesMapById[prop] }
      this.entities = this.entities.filter(p => p.id !== prop)
    } else {
      const p = this.entitiesMap[prop.toLowerCase()]
      if (p) { delete this.entitiesMapById[p.id]; delete this.entitiesMap[prop.toLowerCase()] }
      this.entities = this.entities.filter(p => p.name !== prop.toLowerCase())
    }
  }

  editEntity(prop: Partial<ProductParams> & { id?: number; name?: string }) {
    const p = prop.id ? this.getEntityById(prop.id) : this.getEntityByName(prop.name!)
    p?.setkeys(prop)
  }

  getBySearch(query: string, page = 0): Product[] {
    const start = page * 10
    const terms = query.toLowerCase().split(' ')
    const matches = this.entities.filter(p =>
      terms.some(t => p.name.includes(t) || p.brand.includes(t) || p.categories.includes(t))
    )
    return matches.slice(start, start + 10)
  }
}

// ── Base64Slices ─────────────────────────────────────────────────────────────

export class Base64Slices {
  name: string
  data: string[] = []
  current: number = -1
  total: number
  private _mediaM: MediaManager

  constructor(info: { name: string; current: number | string; total: number | string; string: string; mediaM: MediaManager }) {
    if (!info.mediaM) throw new Error('mediaM required')
    this.name = info.name
    this.current = Number(info.current)
    this.total = Number(info.total)
    this.data = [info.string]
    this._mediaM = info.mediaM
  }

  addSlice(info: { current: number | string; total: number | string; string: string }): { next: number; total: number } {
    if (this.total !== Number(info.total)) {
      this.reset({ total: Number(info.total) })
      return this.returnInfo()
    }
    this.current = Number(info.current)
    this.data.push(info.string)
    return this.current === this.total ? this.createBuffer() : this.returnInfo()
  }

  private createBuffer(): { next: number; total: number } {
    const buffer = Buffer.from(this.data.join('').replace(/^.+,/, ''), 'base64')
    this._mediaM.addEntity({ name: this.name, buffer })
    return this.returnInfo()
  }

  reset(info: { total?: number }) {
    this.data = []
    this.current = -1
    if (info.total !== undefined) this.total = info.total
  }

  returnInfo() {
    return { next: this.current + 1, total: this.total }
  }
}
