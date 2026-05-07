'use client'

import { TenantUsersPage } from '@/components/tenant-users/tenant-users-page'
import { motion } from 'framer-motion'

/**
 * @description Página de gestión de usuarios del tenant para rol manager/admin.
 * @returns {JSX.Element} Panel de control de usuarios scoped al tenant
 */
export default function UsersConfigPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="container mx-auto p-6 space-y-6"
    >
      <TenantUsersPage />
    </motion.div>
  )
}
