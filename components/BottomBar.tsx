'use client'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useStore } from '@/lib/store'
import SearchOverlay from './SearchOverlay'

export default function BottomBar() {
  const router = useRouter()
  const pathname = usePathname()
  const { state } = useStore()
  const [showSearch, setShowSearch] = useState(false)

  const tabs = [
    {
      label: 'Search',
      active: showSearch,
      onClick: () => setShowSearch(true),
      icon: <svg viewBox="0 0 512 512" fill="currentColor" className="w-5 h-5"><path d="M416 208c0 45.4-14.9 87.3-40 120.9L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.9 376c-33.6 25.1-75.5 40-120.9 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/></svg>,
    },
    {
      label: 'Home',
      active: pathname === '/home',
      onClick: () => router.push('/home'),
      icon: <svg viewBox="0 0 576 512" fill="currentColor" className="w-5 h-5"><path d="M575.8 255.5c0 18-15 32.1-32 32.1h-32l.7 160.2c0 2.7-.2 5.4-.5 8.1V472c0 22.1-17.9 40-40 40H392c-22.1 0-40-17.9-40-40V384c0-17.7-14.3-32-32-32H256c-17.7 0-32 14.3-32 32v88c0 22.1-17.9 40-40 40H104c-22.1 0-40-17.9-40-40V360c0-.9 0-1.9 .1-2.8V287.6H32c-18 0-32-14-32-32.1c0-9 3-17 10-24L266.4 8c7-7 15-8 22-8s15 2 21 7L564.8 231.5c8 7 12 15 11 24z"/></svg>,
    },
    {
      label: 'Settings',
      active: pathname === '/settings',
      onClick: () => router.push('/settings'),
      icon: <svg viewBox="0 0 512 512" fill="currentColor" className="w-5 h-5"><path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"/></svg>,
    },
  ]

  return (
    <>
      {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} />}

      {state.runtime.downloading !== undefined && (
        <div className="fixed top-0 left-0 right-0 z-50 h-[3px]" style={{ background: 'var(--bg-raised)' }}>
          <div className="h-full transition-all duration-300" style={{ width: `${state.runtime.downloading}%`, background: 'var(--accent)' }} />
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 h-16"
        style={{ background: 'rgba(15,15,19,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid var(--border)' }}>
        <div className="flex h-full max-w-lg mx-auto">
          {tabs.map(tab => (
            <button key={tab.label} onClick={tab.onClick}
              className="relative flex-1 flex flex-col items-center justify-center gap-[3px] transition-all duration-200"
              style={{ color: tab.active ? 'var(--accent)' : 'var(--text-muted)' }}>
              {tab.icon}
              <span className="text-[10px] font-semibold tracking-wider uppercase">{tab.label}</span>
              {tab.active && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full" style={{ background: 'var(--accent)' }} />}
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}
