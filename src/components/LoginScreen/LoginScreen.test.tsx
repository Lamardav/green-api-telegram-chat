import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createFakeGreenApi,
  FAKE_ID_INSTANCE,
  FAKE_TOKEN,
  type FakeGreenApi,
} from '../../mocks/fakeGreenApi'
import { useSession } from '../../state/session'
import { SessionProvider } from '../../state/SessionProvider'
import { LoginScreen } from './LoginScreen'

let fake: FakeGreenApi
afterEach(() => fake?.dispose())

function LoggedInProbe() {
  const { credentials } = useSession()
  return credentials ? <p>Вошли как {credentials.idInstance}</p> : null
}

function renderLogin(options: Parameters<typeof createFakeGreenApi>[0] = {}) {
  fake = createFakeGreenApi(options)
  render(
    <SessionProvider fetchImpl={fake.fetch}>
      <LoginScreen />
      <LoggedInProbe />
    </SessionProvider>,
  )
  return userEvent.setup()
}

const idField = () => screen.getByLabelText('idInstance')
const tokenField = () => screen.getByLabelText('apiTokenInstance')
const submit = () => screen.getByRole('button', { name: 'Войти' })

describe('LoginScreen', () => {
  it('enables submit only for valid input and derives apiUrl', async () => {
    const user = renderLogin()
    expect(submit()).toBeDisabled()

    await user.type(idField(), '41a')
    expect(screen.getByText('idInstance состоит только из цифр')).toBeInTheDocument()

    await user.clear(idField())
    await user.type(idField(), '4100123456')
    expect(screen.getByLabelText('apiUrl')).toHaveValue('https://4100.api.green-api.com')
    expect(submit()).toBeDisabled()

    await user.type(tokenField(), 'secret')
    expect(submit()).toBeEnabled()
  })

  it('validates a custom apiUrl', async () => {
    const user = renderLogin()
    await user.type(idField(), FAKE_ID_INSTANCE)
    await user.type(tokenField(), FAKE_TOKEN)
    await user.clear(screen.getByLabelText('apiUrl'))
    await user.type(screen.getByLabelText('apiUrl'), 'not-a-url')
    expect(
      screen.getByText('Укажите адрес вида https://1234.api.green-api.com'),
    ).toBeInTheDocument()
    expect(submit()).toBeDisabled()
  })

  it('logs in with valid credentials and stores them for this tab only', async () => {
    const user = renderLogin()
    await user.type(idField(), FAKE_ID_INSTANCE)
    await user.type(tokenField(), FAKE_TOKEN)
    await user.click(submit())

    expect(await screen.findByText(`Вошли как ${FAKE_ID_INSTANCE}`)).toBeInTheDocument()
    expect(sessionStorage.getItem('gac:session')).toContain(FAKE_ID_INSTANCE)
    expect(localStorage.getItem('gac:session')).toBeNull()
  })

  it('reports wrong credentials', async () => {
    const user = renderLogin()
    await user.type(idField(), FAKE_ID_INSTANCE)
    await user.type(tokenField(), 'wrong')
    await user.click(submit())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Неверный idInstance или apiTokenInstance',
    )
    expect(submit()).toBeEnabled()
  })

  it('explains an instance that is not authorized in Telegram', async () => {
    const user = renderLogin({ state: 'notAuthorized' })
    await user.type(idField(), FAKE_ID_INSTANCE)
    await user.type(tokenField(), FAKE_TOKEN)
    await user.click(submit())
    expect(await screen.findByRole('alert')).toHaveTextContent('Инстанс не авторизован')
    expect(sessionStorage.getItem('gac:session')).toBeNull()
  })

  it('reports network problems', async () => {
    const user = renderLogin()
    fake.failNext('getStateInstance', 0)
    await user.type(idField(), FAKE_ID_INSTANCE)
    await user.type(tokenField(), FAKE_TOKEN)
    await user.click(submit())
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось связаться с GREEN-API')
  })
})
