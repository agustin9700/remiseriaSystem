import { FaresRepository } from "./fares.repository";
import { NotFoundError } from "../../lib/errors";

export class FaresService {
  constructor(private readonly faresRepository: FaresRepository) {}

  async getActive() {
    const fare = await this.faresRepository.getActive();
    if (!fare) throw new NotFoundError("No hay tarifa activa configurada");
    return fare;
  }

  async list() {
    return this.faresRepository.list();
  }

  async create(data: {
    nombre: string;
    tarifaBase: number;
    valorPorKm: number;
    valorPorMinuto: number;
    recargoNocturnoPct?: number;
    recargoLluviaPct?: number;
  }) {
    return this.faresRepository.create({
      nombre: data.nombre,
      tarifaBase: data.tarifaBase,
      valorPorKm: data.valorPorKm,
      valorPorMinuto: data.valorPorMinuto,
      recargoNocturnoPct: data.recargoNocturnoPct ?? null,
      recargoLluviaPct: data.recargoLluviaPct ?? null,
      activo: false,
    });
  }

  async setActive(id: string) {
    return this.faresRepository.setActive(id);
  }

  /**
   * Calcula el monto estimado del viaje según la tarifa activa.
   * @param distanciaMetros  Distancia en metros obtenida del mapa
   * @param duracionMinutos  Duración estimada en minutos
   * @param esNocturno       Si aplica recargo nocturno
   */
  async calcularEstimado(
    distanciaMetros: number,
    duracionMinutos: number,
    esNocturno = false
  ): Promise<number> {
    const fare = await this.faresRepository.getActive();
    if (!fare) return 0;

    const distanciaKm = distanciaMetros / 1000;

    let monto =
      Number(fare.tarifaBase) +
      distanciaKm * Number(fare.valorPorKm) +
      duracionMinutos * Number(fare.valorPorMinuto);

    if (esNocturno && fare.recargoNocturnoPct) {
      monto *= 1 + Number(fare.recargoNocturnoPct) / 100;
    }

    return Math.round(monto * 100) / 100;
  }
}
