const { backtestConfig } = require('../config/backtest_config');

class BacktestService {
  constructor(candleData, strategy) {
    this.candleData = candleData;
    this.strategy = strategy;
    this.results = [];
  }

  /**
   * Prepara os dados para o backtest, considerando a opção de iniciar da vela atual
   */
  prepareData(currentCandleIndex = null) {
    let startIndex = 0;
    
    if (backtestConfig.startFromCurrentCandle && currentCandleIndex !== null) {
      // Se configurado para iniciar da vela atual, ajusta o índice inicial
      startIndex = currentCandleIndex - backtestConfig.candlesLookback;
      
      // Garantir que o índice não seja negativo
      startIndex = Math.max(0, startIndex);
      
      console.log(`Backtest iniciado da vela atual (índice ${currentCandleIndex}), considerando ${backtestConfig.candlesLookback} velas anteriores`);
    } else {
      console.log('Backtest iniciado do início do histórico');
    }
    
    // Retorna os dados a serem usados no backtest
    return this.candleData.slice(startIndex);
  }

  /**
   * Executa o backtest com base na configuração
   */
  runBacktest(currentCandleIndex = null) {
    const testData = this.prepareData(currentCandleIndex);
    const results = [];
    
    // Lógica de backtest usando os dados filtrados
    for (let i = 0; i < testData.length; i++) {
      const signal = this.strategy.analyze(testData, i);
      
      if (signal) {
        results.push({
          timestamp: testData[i].timestamp,
          price: testData[i].close,
          type: signal.type,
          profit: signal.profit
        });
      }
    }
    
    this.results = results;
    return results;
  }
  
  /**
   * Gera relatório dos resultados do backtest
   */
  generateReport() {
    if (backtestConfig.generateReport) {
      // Lógica para gerar relatório
      console.log(`Backtest concluído com ${this.results.length} sinais gerados`);
    }
    
    return this.results;
  }
}

module.exports = BacktestService;
