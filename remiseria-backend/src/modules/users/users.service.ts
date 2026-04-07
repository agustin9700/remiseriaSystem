import { RolUsuario } from "@prisma/client";
import { CreateUserInput } from "./users.schemas";
import { UsersRepository } from "./users.repository";
import { ConflictError } from "../../lib/errors";
import bcrypt from "bcrypt";

export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async createUser(input: CreateUserInput) {
    const existingPhone = await this.usersRepository.findByPhone(input.telefono);

    if (existingPhone) {
      throw new ConflictError("Ya existe un usuario con ese teléfono");
    }

    if (input.email) {
      const existingEmail = await this.usersRepository.findByEmail(input.email);

      if (existingEmail) {
        throw new ConflictError("Ya existe un usuario con ese email");
      }
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    return this.usersRepository.create({
      nombre: input.nombre,
      apellido: input.apellido,
      telefono: input.telefono,
      email: input.email,
      passwordHash,
      rol: input.rol as RolUsuario,
    });
  }

  async listUsers() {
    return this.usersRepository.list();
  }
}