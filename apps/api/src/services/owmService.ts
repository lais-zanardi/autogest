export interface WeatherInfo {
  temperatureCelsius: number;
  condition: string;
  humidity: number;
}

export class OWMService {
  /**
   * Consulta OpenWeatherMap API para obter clima na coordenada GPS do abastecimento
   */
  static async getWeatherByCoordinates(lat: number, lon: number): Promise<WeatherInfo | null> {
    const apiKey = process.env.OWM_API_KEY;
    if (!apiKey) {
      return { temperatureCelsius: 24.5, condition: 'Ensolarado', humidity: 60 };
    }
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=pt_br&appid=${apiKey}`,
      );
      if (!response.ok) return null;
      const data: any = await response.json();
      return {
        temperatureCelsius: data.main.temp,
        condition: data.weather[0]?.description || 'Normal',
        humidity: data.main.humidity,
      };
    } catch {
      return null;
    }
  }
}
