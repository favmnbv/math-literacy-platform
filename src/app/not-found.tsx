import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone">
      <h1>404</h1>
      <p>Страница не найдена · Бет табылмады</p>
      <Link href="/dashboard">Вернуться · Оралу</Link>
    </main>
  );
}
