"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Trash2, Edit, Plus, ArrowLeftRight } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Currency } from "../../app/models/model"

export default function CurrencyConverter() {
  const [currencies, setCurrencies] = useState<Currency[]>([
    { id: "1", code: "USD", name: "Dólar Estadounidense", rate: 1, symbol: "$" },
    { id: "2", code: "EUR", name: "Euro", rate: 0.92, symbol: "€" },
    { id: "3", code: "MXN", name: "Peso Mexicano", rate: 17.5, symbol: "$" },
  ])

  const [newCurrency, setNewCurrency] = useState({
    code: "",
    name: "",
    rate: "",
    symbol: "",
  })

  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  // Converter state
  const [fromCurrency, setFromCurrency] = useState("USD")
  const [toCurrency, setToCurrency] = useState("EUR")
  const [amount, setAmount] = useState("1")
  const [result, setResult] = useState("0")

  // Add new currency
  const handleAddCurrency = () => {
    if (newCurrency.code && newCurrency.name && newCurrency.rate && newCurrency.symbol) {
      const currency: Currency = {
        id: Date.now().toString(),
        code: newCurrency.code.toUpperCase(),
        name: newCurrency.name,
        rate: Number.parseFloat(newCurrency.rate),
        symbol: newCurrency.symbol,
      }
      setCurrencies([...currencies, currency])
      setNewCurrency({ code: "", name: "", rate: "", symbol: "" })
    }
  }

  // Delete currency
  const handleDeleteCurrency = (id: string) => {
    setCurrencies(currencies.filter((c) => c.id !== id))
  }

  // Edit currency
  const handleEditCurrency = (currency: Currency) => {
    setEditingCurrency(currency)
    setIsEditDialogOpen(true)
  }

  const handleUpdateCurrency = () => {
    if (editingCurrency) {
      setCurrencies(currencies.map((c) => (c.id === editingCurrency.id ? editingCurrency : c)))
      setIsEditDialogOpen(false)
      setEditingCurrency(null)
    }
  }

  // Convert currencies
  const convertCurrency = useCallback(() => {
    const fromRate = currencies.find((c) => c.code === fromCurrency)?.rate || 1
    const toRate = currencies.find((c) => c.code === toCurrency)?.rate || 1
    const amountNum = Number.parseFloat(amount) || 0

    // Convert to USD first, then to target currency
    const usdAmount = amountNum / fromRate
    const convertedAmount = usdAmount * toRate

    setResult(convertedAmount.toFixed(4))
  }, [currencies, fromCurrency, toCurrency, amount])

  // Auto-convert when values change
  useEffect(() => {
    convertCurrency()
  }, [amount, fromCurrency, toCurrency, currencies, convertCurrency])

  const swapCurrencies = () => {
    setFromCurrency(toCurrency)
    setToCurrency(fromCurrency)
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Convertidor de Monedas Personalizado</h1>
        <p className="text-muted-foreground mt-2">Agrega tus propias monedas y convierte entre ellas</p>
      </div>

      <Tabs defaultValue="converter" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="converter">Convertidor</TabsTrigger>
          <TabsTrigger value="manage">Gestionar Monedas</TabsTrigger>
          <TabsTrigger value="add">Agregar Moneda</TabsTrigger>
        </TabsList>

        <TabsContent value="converter" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5" />
                Convertidor de Monedas
              </CardTitle>
              <CardDescription>Convierte entre tus monedas personalizadas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="from-currency">De</Label>
                  <Select value={fromCurrency} onValueChange={setFromCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((currency) => (
                        <SelectItem key={currency.id} value={currency.code}>
                          {currency.symbol} {currency.code} - {currency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="to-currency">A</Label>
                  <Select value={toCurrency} onValueChange={setToCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((currency) => (
                        <SelectItem key={currency.id} value={currency.code}>
                          {currency.symbol} {currency.code} - {currency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <Button variant="outline" size="icon" onClick={swapCurrencies}>
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Cantidad</Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ingresa la cantidad"
                />
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Resultado</div>
                <div className="text-2xl font-bold">
                  {currencies.find((c) => c.code === toCurrency)?.symbol}
                  {result} {toCurrency}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {currencies.find((c) => c.code === fromCurrency)?.symbol}
                  {amount} {fromCurrency} = {currencies.find((c) => c.code === toCurrency)?.symbol}
                  {result} {toCurrency}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monedas Disponibles</CardTitle>
              <CardDescription>Gestiona tus monedas personalizadas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {currencies.map((currency) => (
                  <div key={currency.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{currency.code}</Badge>
                      <div>
                        <div className="font-medium">{currency.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Tasa: {currency.rate} | Símbolo: {currency.symbol}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" onClick={() => handleEditCurrency(currency)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDeleteCurrency(currency.id)}
                        disabled={currency.code === "USD"} // No permitir eliminar USD
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="add" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Agregar Nueva Moneda
              </CardTitle>
              <CardDescription>Crea una moneda personalizada con su tasa de cambio</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Código de Moneda</Label>
                  <Input
                    id="code"
                    value={newCurrency.code}
                    onChange={(e) => setNewCurrency({ ...newCurrency, code: e.target.value })}
                    placeholder="ej. BTC, GOLD"
                    maxLength={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="symbol">Símbolo</Label>
                  <Input
                    id="symbol"
                    value={newCurrency.symbol}
                    onChange={(e) => setNewCurrency({ ...newCurrency, symbol: e.target.value })}
                    placeholder="ej. ₿, 🥇"
                    maxLength={3}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la Moneda</Label>
                <Input
                  id="name"
                  value={newCurrency.name}
                  onChange={(e) => setNewCurrency({ ...newCurrency, name: e.target.value })}
                  placeholder="ej. Bitcoin, Oro"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rate">Tasa de Cambio (respecto a USD)</Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.0001"
                  value={newCurrency.rate}
                  onChange={(e) => setNewCurrency({ ...newCurrency, rate: e.target.value })}
                  placeholder="ej. 45000 (para Bitcoin)"
                />
                <div className="text-sm text-muted-foreground">
                  Ingresa cuántas unidades de esta moneda equivalen a 1 USD
                </div>
              </div>

              <Button onClick={handleAddCurrency} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Moneda
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Moneda</DialogTitle>
            <DialogDescription>Modifica los detalles de la moneda</DialogDescription>
          </DialogHeader>
          {editingCurrency && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input
                  value={editingCurrency.code}
                  onChange={(e) => setEditingCurrency({ ...editingCurrency, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={editingCurrency.name}
                  onChange={(e) => setEditingCurrency({ ...editingCurrency, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Símbolo</Label>
                <Input
                  value={editingCurrency.symbol}
                  onChange={(e) => setEditingCurrency({ ...editingCurrency, symbol: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tasa de Cambio</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={editingCurrency.rate}
                  onChange={(e) => setEditingCurrency({ ...editingCurrency, rate: Number.parseFloat(e.target.value) })}
                />
              </div>
              <Button onClick={handleUpdateCurrency} className="w-full">
                Actualizar Moneda
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
