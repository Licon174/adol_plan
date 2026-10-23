import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { TABS, pageRoute } from './pages'
import { isAuthed, onAuthChange } from '@/api'

import TabShell from '@/layouts/TabShell.vue'
import HomePage from '@/pages/HomePage.vue'
import TabListPage from '@/pages/TabListPage.vue'
import PlaceholderPage from '@/pages/PlaceholderPage.vue'
import LoginPage from '@/pages/LoginPage.vue'

const children: RouteRecordRaw[] = []

for (const tab of TABS) {

  children.push({
    path: tab.path,
    name: tab.key,
    component: tab.key === 'home' ? HomePage : TabListPage,
    props: tab.key === 'home' ? undefined : { tabKey: tab.key },
    meta: { tab: tab.key, title: tab.name },
  })

  for (const page of tab.pages) {
    children.push({
      path: pageRoute(tab, page),
      name: `${tab.key}.${page.path}`,
      component: page.component ?? PlaceholderPage,
      props: page.component ? undefined : { tabKey: tab.key, pagePath: page.path },
      meta: { tab: tab.key, title: page.name },
    })
  }
}

export const routes: RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: LoginPage, meta: { public: true } },
  {
    path: '/',
    component: TabShell,
    children: [
      { path: '', redirect: '/home' },
      ...children,
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/home' },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const isPublic = to.meta.public === true
  if (!isAuthed() && !isPublic) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (isAuthed() && isPublic) {
    return { path: '/home' }
  }
  return true
})

onAuthChange((authed) => {
  if (!authed && router.currentRoute.value.name !== 'login') {
    void router.replace({ name: 'login', query: { kicked: '1' } })
  }
})
