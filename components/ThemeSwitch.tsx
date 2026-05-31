'use client'

import { Fragment, useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Radio,
  RadioGroup,
  Transition,
} from '@headlessui/react'

const Sun = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="group:hover:text-gray-100 h-6 w-6"
  >
    <path
      fillRule="evenodd"
      d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
      clipRule="evenodd"
    />
  </svg>
)
const Moon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="group:hover:text-gray-100 h-6 w-6"
  >
    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
  </svg>
)
const Monitor = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="group:hover:text-gray-100 h-6 w-6"
  >
    <rect x="3" y="3" width="14" height="10" rx="2" ry="2"></rect>
    <line x1="7" y1="17" x2="13" y2="17"></line>
    <line x1="10" y1="13" x2="10" y2="17"></line>
  </svg>
)
const Blank = () => <svg className="h-6 w-6" />

// ...（Sun, Moon, Monitor, Blank 图标组件保持不变）...

const ThemeSwitch = () => {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()

  // 2. 完美的视图过渡核心函数
  const handleThemeChange = (nextTheme: string, e: MouseEvent<HTMLButtonElement>) => {
    // 降级处理
    if (!document.startViewTransition) {
      setTheme(nextTheme)
      return
    }

    const x = e.clientX
    const y = e.clientY

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    )

    const root = document.documentElement
    root.classList.add('theme-transition')
    root.style.setProperty('--click-x', `${x}px`)
    root.style.setProperty('--click-y', `${y}px`)
    root.style.setProperty('--end-radius', `${endRadius}px`)

    const transition = document.startViewTransition(async () => {
      // 核心：这里一定要执行改变状态，从而触发 next-themes 修改 html 的 class
      setTheme(nextTheme)
    })

    transition.finished.finally(() => {
      root.classList.remove('theme-transition')
    })
  }

  useEffect(() => setMounted(true), [])

  return (
    <div className="flex items-center">
      <Menu as="div" className="relative inline-block text-left">
        <div className="hover:text-primary-500 dark:hover:text-primary-400 flex items-center justify-center">
          <MenuButton aria-label="Theme switcher">
            {mounted ? resolvedTheme === 'dark' ? <Moon /> : <Sun /> : <Blank />}
          </MenuButton>
        </div>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <MenuItems className="ring-opacity-5 absolute right-0 z-50 mt-2 w-32 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black focus:outline-hidden dark:bg-gray-800">
            {/* 3. 修复：RadioGroup 只负责绑定 value，不要在它的 onChange 里传事件 */}
            <RadioGroup value={theme}>
              <div className="p-1">

                {/* Light 选项 */}
                <Radio value="light">
                  <MenuItem>
                    {({ focus }) => (
                      <button
                        // 4. 修复：直接在 button 的 onClick 上捕获准确的点击坐标
                        onClick={(e) => handleThemeChange('light', e)}
                        className={`${focus ? 'bg-primary-600 text-white' : 'text-gray-900 dark:text-gray-100'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                      >
                        <div className="mr-2"><Sun /></div>
                        Light
                      </button>
                    )}
                  </MenuItem>
                </Radio>

                {/* Dark 选项 */}
                <Radio value="dark">
                  <MenuItem>
                    {({ focus }) => (
                      <button
                        onClick={(e) => handleThemeChange('dark', e)}
                        className={`${focus ? 'bg-primary-600 text-white' : 'text-gray-900 dark:text-gray-100'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                      >
                        <div className="mr-2"><Moon /></div>
                        Dark
                      </button>
                    )}
                  </MenuItem>
                </Radio>

                {/* System 选项 */}
                <Radio value="system">
                  <MenuItem>
                    {({ focus }) => (
                      <button
                        onClick={(e) => handleThemeChange('system', e)}
                        className={`${focus ? 'bg-primary-600 text-white' : 'text-gray-900 dark:text-gray-100'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                      >
                        <div className="mr-2"><Monitor /></div>
                        System
                      </button>
                    )}
                  </MenuItem>
                </Radio>

              </div>
            </RadioGroup>
          </MenuItems>
        </Transition>
      </Menu>
    </div>
  )
}

export default ThemeSwitch