"use client"

import { useState, useEffect } from "react"
import { Lock } from "lucide-react"

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Toaster, toast } from "sonner"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [pin, setPin] = useState("")

  useEffect(() => {
    // Check for existing session
    const auth = localStorage.getItem("admin_access")
    if (auth === "authorized") {
      setIsAuthenticated(true)
    }
    setIsLoading(false)
  }, [])

  const handleVerify = (inputPin: string) => {
    if (inputPin === "8888") { // Default PIN
      localStorage.setItem("admin_access", "authorized")
      setIsAuthenticated(true)
      toast.success("Access Granted")
    } else {
      toast.error("Incorrect PIN")
      setPin("")
    }
  }

  const handleChange = (value: string) => {
    setPin(value)
    if (value.length === 4) {
      handleVerify(value)
    }
  }

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm shadow-lg">
            <CardHeader className="text-center space-y-2">
              <div className="mx-auto bg-gray-100 p-3 rounded-full w-fit">
                <Lock className="w-6 h-6 text-gray-600" />
              </div>
              <CardTitle className="text-2xl">Admin Access</CardTitle>
              <CardDescription>
                Please enter the security PIN to continue.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-6 pt-4">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={4}
                  value={pin}
                  onChange={handleChange}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Default access PIN is 8888
              </p>
            </CardContent>
          </Card>
        </div>
        <Toaster />
      </>
    )
  }

  return (
    <>
      {children}
    </>
  )
}
