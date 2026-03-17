import { useState } from 'react'
import { Sidebar, type PageType } from './components/layout'
import { HomePage, AboutPage, SettingsPage, ProcessesPage } from './components/pages'
import { UpdateDialog } from './components/UpdateDialog'
import { CloseConfirmDialog } from './components/CloseConfirmDialog'

function App(): React.JSX.Element {
  const [currentPage, setCurrentPage] = useState<PageType>('home')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage />
      case 'processes':
        return <ProcessesPage />
      case 'settings':
        return <SettingsPage />
      case 'about':
        return <AboutPage />
      default:
        return <HomePage />
    }
  }

  return (
    <div className="h-screen bg-background flex">
      <Sidebar
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className="flex-1 overflow-auto">{renderPage()}</main>
      <UpdateDialog />
      <CloseConfirmDialog />
    </div>
  )
}

export default App
