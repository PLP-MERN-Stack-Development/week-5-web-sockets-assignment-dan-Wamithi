import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { ThemeProvider, createTheme } from "@mui/material/styles"
import CssBaseline from "@mui/material/CssBaseline"
import { Toaster } from "react-hot-toast"

import { useAuthStore } from "./store/authStore"
import Login from "./components/Auth/Login"
import Register from "./components/Auth/Register"
import Chat from "./components/Chat/Chat"
import ProtectedRoute from "./components/ProtectedRoute"

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#dc004e",
    },
  },
})

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={isAuthenticated ? <Navigate to="/chat" /> : <Login />} />
            <Route path="/register" element={isAuthenticated ? <Navigate to="/chat" /> : <Register />} />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to={isAuthenticated ? "/chat" : "/login"} />} />
          </Routes>
          <Toaster position="top-right" />
        </div>
      </Router>
    </ThemeProvider>
  )
}

export default App
