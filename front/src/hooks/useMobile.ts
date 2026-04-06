import { useState, useEffect } from 'react'

/**
 * 检测是否为移动端设备（宽度 < 768px）
 * 用于响应式布局适配
 */
export function useMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < breakpoint
  })

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    
    // 监听窗口大小变化
    window.addEventListener('resize', check)
    
    // 初始检查
    check()
    
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])

  return isMobile
}

/**
 * 检测是否为平板设备（768px <= 宽度 < 1024px）
 */
export function useTablet(breakpointMin = 768, breakpointMax = 1024): boolean {
  const [isTablet, setIsTablet] = useState(() => {
    if (typeof window === 'undefined') return false
    const w = window.innerWidth
    return w >= breakpointMin && w < breakpointMax
  })

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth
      setIsTablet(w >= breakpointMin && w < breakpointMax)
    }
    window.addEventListener('resize', check)
    check()
    return () => window.removeEventListener('resize', check)
  }, [breakpointMin, breakpointMax])

  return isTablet
}
