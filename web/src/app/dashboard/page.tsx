'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { useUser } from "@/components/user-context"
import { DashboardCards } from "@/lib/menu"
import { useTranslation } from "react-i18next"


export default function DashboardPage() {
  const { hasPermission } = useUser()
  const { t } = useTranslation()
  return (
    <div className="w-full max-w-5xl px-6 py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
        <p className="text-gray-600 mt-2">
          {t('dashboard.description')}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {DashboardCards.map((card) => {
          const Icon = card.icon;
          const isVisible = !card.permission || hasPermission(card.permission);
          if (!isVisible) return null;

          return (
            <Card key={card.href} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  {card.titleKey ? t(card.titleKey) : card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={card.href}>
                  <Button className="w-full">
                    {card.buttonTextKey ? t(card.buttonTextKey) : card.buttonText}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  )
} 
