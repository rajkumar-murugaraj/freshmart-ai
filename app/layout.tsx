import type { Metadata } from 'next';
import './globals.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ThemeProvider } from './context/ThemeContext';
import { WishlistProvider } from './context/WishlistContext';

export const metadata: Metadata = {
  title: 'FreshMart AI - Your Smart Grocery Store',
  description: 'Shop fresh groceries with AI-powered assistance',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <ThemeProvider>
          <WishlistProvider>
            {children}
            <ToastContainer
              position="top-right"
              autoClose={5000}
              hideProgressBar
              newestOnTop
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="colored"
            />
          </WishlistProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
