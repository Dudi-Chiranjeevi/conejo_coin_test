import NextAuth from "next-auth";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
// Add type declaration for bcrypt
// @ts-ignore - Ignore bcrypt type issues
import { compare } from "bcrypt";

// Define custom user type to include role
declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name?: string;
    role: string;
    image?: string;
  }
  
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string;
      role: string;
      image?: string;
    }
  }
}

// Mock Firebase authentication service
const firebaseAuth = {
  getUserByEmail: async (email: string) => {
    // This would be replaced with actual Firebase auth calls
    // Mock response for development
    if (email === "admin@conejocoin.com") {
      return {
        id: "admin-user-id",
        email: "admin@conejocoin.com",
        firstName: "Admin",
        lastName: "User",
        password: "$2b$10$XdKoGOCkDLZ838/kJ54BsuZr0kx6hhK3qPldO9HGhPpIZ7Gg.D3Iq", // hashed 'Admin@123'
        role: "admin",
        avatar: null
      };
    }
    return null;
  },
  verifyPassword: async (plainPassword: string, hashedPassword: string) => {
    return compare(plainPassword, hashedPassword);
  }
};

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Use Firebase auth instead of direct DB access
        const user = await firebaseAuth.getUserByEmail(credentials.email);

        if (!user || !user.password) {
          return null;
        }

        const passwordMatch = await firebaseAuth.verifyPassword(credentials.password, user.password);

        if (!passwordMatch) {
          return null;
        }

        // Ensure the return type matches the User interface
        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
          role: user.role,
          image: user.avatar || undefined, // Convert null to undefined for type compatibility
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.role = token.role as string;
      }
      return session;
    }
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
