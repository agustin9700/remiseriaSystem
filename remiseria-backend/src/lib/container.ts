// Singletons de repositories y services
import { OrdersRepository } from "../modules/orders/orders.repository";
import { OrdersService } from "../modules/orders/orders.service";
import { DriversRepository } from "../modules/drivers/drivers.repository";
import { DriversService } from "../modules/drivers/drivers.service";
import { UsersRepository } from "../modules/users/users.repository";
import { UsersService } from "../modules/users/users.service";
import { AuthService } from "../modules/auth/auth.service";
import { FaresRepository } from "../modules/fares/fares.repository";
import { FaresService } from "../modules/fares/fares.service";

const ordersRepository = new OrdersRepository();
const driversRepository = new DriversRepository();
const usersRepository = new UsersRepository();
const faresRepository = new FaresRepository();

export const ordersService = new OrdersService(ordersRepository);
export const driversService = new DriversService(driversRepository);
export const usersService = new UsersService(usersRepository);
export const authService = new AuthService();
export const faresService = new FaresService(faresRepository);
