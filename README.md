//+------------------------------------------------------------------+
   //|                                                          Alma.mq5 |
   //|                        Copyright 2025, Natan Sebben (natansebben) |
   //|                                     Last updated: 2025-05-03 00:15 |
   //+------------------------------------------------------------------+
   #property copyright "Copyright 2025, Natan Sebben (natansebben)"
   #property version   "2.18"
   #property description "Updated on 2025-05-03 00:15:00 UTC - Adicionado modo backtest para velas passadas"
   #property indicator_chart_window
   #property indicator_buffers 4  // Aumentado para 4 para incluir os buffers de pré-alerta
   #property indicator_plots   4  // Aumentado para 4 para incluir os plots de pré-alerta

   //--- plot Call
   #property indicator_label1  "Sinal de Call"
   #property indicator_type1   DRAW_ARROW
   #property indicator_color1  clrWhite
   #property indicator_style1  STYLE_SOLID
   #property indicator_width1  1

   //--- plot Put
   #property indicator_label2  "Sinal de Put"
   #property indicator_type2   DRAW_ARROW
   #property indicator_color2  clrWhite
   #property indicator_style2  STYLE_SOLID
   #property indicator_width2  1

   //--- plot PreCall
   #property indicator_label3  "Pré-Alerta Call"
   #property indicator_type3   DRAW_ARROW
   #property indicator_color3  clrLime
   #property indicator_style3  STYLE_SOLID
   #property indicator_width3  2

   //--- plot PrePut
   #property indicator_label4  "Pré-Alerta Put"
   #property indicator_type4   DRAW_ARROW
   #property indicator_color4  clrRed
   #property indicator_style4  STYLE_SOLID
   #property indicator_width4  2

   //--- parâmetros de entrada
   input int      AnalyzedCandles    = 100;       // Quantidade de velas analisadas
   input int      IntervaloVelas     = 0;         // Intervalo de velas: 0=desativado, >0=qtd velas entre sinais

   // Opções de Backtest
   input string   s1                 = "--- SINAIS BACK TEST ---"; // ----------
   input bool     VelasPassadas      = true;      // Velas passadas: true/false
   input bool     VelasAtuais        = true;      // Velas atuais: true/false
   input int      ExpiracaoVelas     = 0;         // Expiração em velas: 0=desativado, >=1=número de velas

   // Sistema de Pré-Alertas
   input bool     UsePreAlertas      = true;      // Ativar sistema de pré-alertas
   input bool     IntervaloPreAlertas= true;      // Aplicar intervalo de velas nos pré-alertas

   // Indicador 1
   input bool     UseExternalInd1    = true;      // Ativar indicador 1
   input string   ExternalIndName1   = "";        // Nome do indicador 1
   input int      ExtCallBufferIndex1= 0;         // Buffer de Call - Indicador 1
   input int      ExtPutBufferIndex1 = 1;         // Buffer de Put - Indicador 1
   input bool     NextCandleEntry1   = false;     // Entrada na próxima vela - Indicador 1

   // Indicador 2
   input bool     UseExternalInd2    = false;     // Ativar indicador 2
   input string   ExternalIndName2   = "";        // Nome do indicador 2
   input int      ExtCallBufferIndex2= 0;         // Buffer de Call - Indicador 2
   input int      ExtPutBufferIndex2 = 1;         // Buffer de Put - Indicador 2
   input bool     NextCandleEntry2   = false;     // Entrada na próxima vela - Indicador 2

   // Opções do painel de backtest
   input string   s2                 = "--- PAINEL BACKTEST ---"; // ----------
   input bool     MostrarPainel      = true;      // Mostrar painel de estatísticas
   input int      PainelX            = 20;        // Posição X do painel
   input int      PainelY            = 20;        // Posição Y do painel
   input color    CorFundoPainel     = clrBlack;  // Cor de fundo do painel
   input color    CorBordaPainel     = clrWhite;  // Cor da borda do painel
   input color    CorTextoPainel     = clrWhite;  // Cor do texto do painel
   input color    CorWin             = clrLime;   // Cor para wins
   input color    CorLoss            = clrRed;    // Cor para losses

   //--- Variáveis internas (não expostas como parâmetros de entrada)
   bool           ShowDebugInfo      = true;      // Mostrar informações de debug
   bool           IgnoreMultiSignals = true;      // Ignorar indicador com sinais CALL e PUT simultâneos
   double         MinValidValue      = 0.9;       // Valor mínimo para considerar o sinal válido
   bool           PriceInCallBuffer  = true;      // O buffer CALL contém preços (não sinais)
   bool           RequireConfluence  = false;     // Definido automaticamente com base nos indicadores ativos
   int            SignalPriority     = 0;         // Valor padrão: Ignorar ambos sinais em caso de conflito
   bool           ProtectHistoricalSignals = true; // Proteger sinais em velas passadas contra alterações
   bool           UltimoVelasPassadas = true;     // Rastreia o último estado de VelasPassadas

   // Variáveis para filtro de intervalo entre sinais
   datetime       ultimoTempoSinal = 0;           // Tempo da última vela com sinal permitido
   datetime       ultimoTempoPreAlerta = 0;       // Tempo do último pré-alerta permitido

   // Variáveis para estatísticas do backtest
   int            totalSinais        = 0;         // Total de sinais
   int            totalWins          = 0;         // Total de wins
   int            totalLosses        = 0;         // Total de losses
   double         assertividade      = 0.0;       // Assertividade em %
   string         nomePainel         = "AlmaPainelBacktest"; // Nome do objeto do painel
   int            lossesConsecutivos = 0;         // Contador de losses consecutivos atual
   int            maxLossesConsecutivos = 0;      // Máximo de losses consecutivos histórico
   
   // Variáveis para estatísticas de Gale 1
   int            winGale1           = 0;         // Wins com estratégia Gale 1
   int            lossGale1          = 0;         // Losses com estratégia Gale 1
   int            maxLossGale1       = 0;         // Máximo de losses consecutivos com Gale 1
   double         assertividadeGale1 = 0.0;       // Assertividade com Gale 1 em %

   //--- buffers do indicador
   double         SignalCallBuffer[];
   double         SignalPutBuffer[];
   double         PreCallBuffer[];    // Buffer para pré-alertas de CALL
   double         PrePutBuffer[];     // Buffer para pré-alertas de PUT

   //--- Códigos das setas
   #define ARROW_CALL      233
   #define ARROW_PUT       234
   #define ICON_WIN        254
   #define ICON_LOSS       253
   #define ICON_PRE_ALERT  164        // Ícone para pré-alertas

   //--- Estrutura para armazenar informações dos sinais
   struct SignalInfo
   {
      datetime time;      // Tempo do sinal
      double price;       // Preço do sinal
      bool isCall;        // true para CALL, false para PUT
      bool isWin;         // Resultado final (só é definido após o fechamento do candle)
      bool isClosed;      // Indica se o candle já fechou
      double openPrice;   // Preço de abertura do candle
      double closePrice;  // Preço de fechamento do candle
      datetime expirationTime; // Tempo da vela de expiração
      bool expProcessed;  // Indica se a expiração já foi processada
   };

   //--- Estrutura para armazenar informações de pré-alertas
   struct PreAlertInfo
   {
      datetime time;      // Tempo do pré-alerta
      double price;       // Preço do pré-alerta
      bool isCall;        // true para CALL, false para PUT
      bool converted;     // true se já foi convertido em sinal
   };

   //--- Variáveis globais
   int            externalHandle1, externalHandle2;
   double         extCallValues1[], extPutValues1[];
   double         extCallValues2[], extPutValues2[];
   datetime       lastSignalTime = 0;        // Armazena o tempo do último sinal
   int            lastSignalType = 0;        // 1 para CALL, 2 para PUT
   SignalInfo     historicalSignals[];       // Array para armazenar sinais históricos
   PreAlertInfo   preAlerts[];               // Array para armazenar pré-alertas
   datetime       lastProcessedBarTime = 0;  // Armazena o tempo da última vela processada

   //+------------------------------------------------------------------+
   //| Função para imprimir mensagens de debug                           |
   //+------------------------------------------------------------------+
   void DebugPrint(string message)
   {
      if(ShowDebugInfo)
         Print("[Alma Debug] ", message);
   }

   //+------------------------------------------------------------------+
   //| CORREÇÃO CRÍTICA: Função para verificar se um valor é um sinal válido |
   //+------------------------------------------------------------------+
   bool IsValidSignalValue(double value)
   {
      // CORREÇÃO PARA PROBLEMA DE VALOR EXATO 1.0
      // Primeiro verificar se é EMPTY_VALUE (que nunca é válido)
      if(value == EMPTY_VALUE)
         return false;
         
      // Verificação ESPECIAL para o valor 1.0 (com tolerância para imprecisões)
      if(MathAbs(value - 1.0) < 0.000001)
      {
         return true; // Valor exatamente 1.0 (ou muito próximo) é SEMPRE válido
      }
      
      // Verificar se é maior ou igual ao valor mínimo
      return MathAbs(value) >= MinValidValue;
   }

   //+------------------------------------------------------------------+
   //| NOVA FUNÇÃO: Para verificar se um valor parece ser um preço      |
   //+------------------------------------------------------------------+
   bool IsLikelyPrice(double value)
   {
      // Se for maior que 100, provavelmente é um preço
      return value > 100.0;
   }

   //+------------------------------------------------------------------+
   //| Função de inicialização do indicador customizado                   |
   //+------------------------------------------------------------------+
   int OnInit()
   {
      Print("===== ALMA INICIALIZAÇÃO =====");
      // Remover objetos existentes para evitar duplicidade
      ObjectsDeleteAll(0, "WinLoss_");
      ObjectsDeleteAll(0, "PreAlert_");
      ObjectsDeleteAll(0, "AlmaPainel");
      
      //--- mapeamento dos buffers do indicador
      SetIndexBuffer(0, SignalCallBuffer, INDICATOR_DATA);
      SetIndexBuffer(1, SignalPutBuffer, INDICATOR_DATA);
      SetIndexBuffer(2, PreCallBuffer, INDICATOR_DATA);
      SetIndexBuffer(3, PrePutBuffer, INDICATOR_DATA);
      
      //--- Configuração das propriedades das setas
      PlotIndexSetInteger(0, PLOT_ARROW, ARROW_CALL);
      PlotIndexSetInteger(1, PLOT_ARROW, ARROW_PUT);
      PlotIndexSetInteger(2, PLOT_ARROW, ICON_PRE_ALERT);  // Ícone para pré-alertas de CALL
      PlotIndexSetInteger(3, PLOT_ARROW, ICON_PRE_ALERT);  // Ícone para pré-alertas de PUT
      
      //--- Definição do valor vazio
      PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);
      PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, EMPTY_VALUE);
      PlotIndexSetDouble(2, PLOT_EMPTY_VALUE, EMPTY_VALUE);
      PlotIndexSetDouble(3, PLOT_EMPTY_VALUE, EMPTY_VALUE);
      
      //--- Inicialização dos buffers como séries
      ArraySetAsSeries(SignalCallBuffer, true);
      ArraySetAsSeries(SignalPutBuffer, true);
      ArraySetAsSeries(PreCallBuffer, true);
      ArraySetAsSeries(PrePutBuffer, true);
      
      //--- Inicializar array de sinais históricos e pré-alertas
      ArrayResize(historicalSignals, 0);
      ArrayResize(preAlerts, 0);
      
      // Inicializar arrays para indicadores externos
      ArrayResize(extCallValues1, 0);
      ArrayResize(extPutValues1, 0);
      ArrayResize(extCallValues2, 0);
      ArrayResize(extPutValues2, 0);
      
      // Inicializar filtro de intervalo
      ultimoTempoSinal = 0;
      ultimoTempoPreAlerta = 0;
      
      // ALERTA: Se o MinValidValue for muito alto, pode impedir a detecção de valores 1.0
      if(MinValidValue > 0.9 && MinValidValue != 1.0)
      {
         Print("[Alma AVISO] MinValidValue muito alto (" + DoubleToString(MinValidValue) + 
               ") pode dificultar detecção de sinais. Recomendado: 0.9 ou menos.");
      }
      
      // Verificação das opções de backtest
      if(!VelasPassadas && !VelasAtuais)
      {
         Print("[Alma AVISO] Ambas as opções de backtest desativadas. Nenhum sinal será exibido!");
      }
      
      // CONFIGURAÇÃO AUTOMÁTICA DE CONFLUÊNCIA
      // Define RequireConfluence automaticamente com base nos indicadores ativos
      RequireConfluence = (UseExternalInd1 && UseExternalInd2);
      
      // Aviso sobre regra especial de intervalo para pré-alertas
      if(UsePreAlertas && IntervaloVelas == 0 && IntervaloPreAlertas)
      {
         Print("[Alma AVISO] Pré-Alertas ativos com IntervaloVelas=0: Um intervalo mínimo de 1 vela será aplicado aos pré-alertas.");
      }
      
      Print("[Alma] Configurações:");
      Print("[Alma] - Modo Backtest: Velas Passadas=" + (VelasPassadas ? "ATIVADO" : "DESATIVADO") + 
            ", Velas Atuais=" + (VelasAtuais ? "ATIVADO" : "DESATIVADO"));
      Print("[Alma] - Expiração em velas: " + (ExpiracaoVelas > 0 ? IntegerToString(ExpiracaoVelas) + " vela(s)" : "DESATIVADO"));
      Print("[Alma] - Sistema de Pré-Alertas: " + (UsePreAlertas ? "ATIVADO" : "DESATIVADO"));
      Print("[Alma] - Proteção de Sinais Históricos: " + (ProtectHistoricalSignals ? "ATIVADO" : "DESATIVADO"));
      Print("[Alma] - Intervalo nos Pré-Alertas: " + (IntervaloPreAlertas ? "ATIVADO" : "DESATIVADO") + 
            (UsePreAlertas && IntervaloVelas == 0 && IntervaloPreAlertas ? " (mínimo 1 vela)" : ""));
      Print("[Alma] - RequireConfluence: " + (RequireConfluence ? "SIM (automático)" : "NÃO (automático)"));
      Print("[Alma] - IgnoreMultiSignals: " + (IgnoreMultiSignals ? "SIM" : "NÃO"));
      Print("[Alma] - PriceInCallBuffer: " + (PriceInCallBuffer ? "SIM" : "NÃO"));
      Print("[Alma] - MinValidValue: " + DoubleToString(MinValidValue));
      Print("[Alma] - UseExternalInd1: " + (UseExternalInd1 ? "SIM" : "NÃO"));
      Print("[Alma] - NextCandleEntry1: " + (NextCandleEntry1 ? "SIM (próxima vela)" : "NÃO (mesma vela)"));
      Print("[Alma] - UseExternalInd2: " + (UseExternalInd2 ? "SIM" : "NÃO"));
      Print("[Alma] - NextCandleEntry2: " + (NextCandleEntry2 ? "SIM (próxima vela)" : "NÃO (mesma vela)"));
      Print("[Alma] - Intervalo de velas: " + (IntervaloVelas > 0 ? IntegerToString(IntervaloVelas) : "DESATIVADO"));
      
      //--- Inicialização do handle do indicador 1
      if(UseExternalInd1)
      {
         if(ExternalIndName1 == "")
         {
            Print("[Alma ERRO] Nome do indicador 1 não foi especificado!");
            return(INIT_PARAMETERS_INCORRECT);
         }
         
         externalHandle1 = iCustom(_Symbol, PERIOD_CURRENT, ExternalIndName1);
         if(externalHandle1 == INVALID_HANDLE)
         {
            Print("[Alma ERRO] Falha ao inicializar indicador 1: " + ExternalIndName1);
            Print("[Alma ERRO] Código do erro: " + IntegerToString(GetLastError()));
            return(INIT_FAILED);
         }
         else
         {
            Print("[Alma] Indicador 1 '" + ExternalIndName1 + "' inicializado com sucesso.");
            Print("[Alma] - Buffer CALL: " + IntegerToString(ExtCallBufferIndex1));
            Print("[Alma] - Buffer PUT: " + IntegerToString(ExtPutBufferIndex1));
         }
      }
      
      //--- Inicialização do handle do indicador 2
      if(UseExternalInd2)
      {
         if(ExternalIndName2 == "")
         {
            Print("[Alma ERRO] Nome do indicador 2 não foi especificado!");
            return(INIT_PARAMETERS_INCORRECT);
         }
         
         externalHandle2 = iCustom(_Symbol, PERIOD_CURRENT, ExternalIndName2);
         if(externalHandle2 == INVALID_HANDLE)
         {
            Print("[Alma ERRO] Falha ao inicializar indicador 2: " + ExternalIndName2);
            Print("[Alma ERRO] Código do erro: " + IntegerToString(GetLastError()));
            return(INIT_FAILED);
         }
         else
         {
            Print("[Alma] Indicador 2 '" + ExternalIndName2 + "' inicializado com sucesso.");
            Print("[Alma] - Buffer CALL: " + IntegerToString(ExtCallBufferIndex2));
            Print("[Alma] - Buffer PUT: " + IntegerToString(ExtPutBufferIndex2));
         }
      }
      
      // Criar painel de backtest
      if(MostrarPainel)
      {
         // Zerar contadores antes de criar o painel
         totalSinais = 0;
         totalWins = 0;
         totalLosses = 0;
         assertividade = 0.0;
         lossesConsecutivos = 0;
         maxLossesConsecutivos = 0;
         
         CriarPainel();
         Print("[Alma] Painel de backtest inicializado");
      }
      
      Print("===== ALMA INICIALIZAÇÃO CONCLUÍDA =====");
      return(INIT_SUCCEEDED);
   }

   //+------------------------------------------------------------------+
   //| Verifica se já existe um sinal histórico                          |
   //+------------------------------------------------------------------+
   bool ExistsHistoricalSignal(datetime time)
   {
      for(int i = 0; i < ArraySize(historicalSignals); i++)
      {
         if(historicalSignals[i].time == time)
            return true;
      }
      return false;
   }

   //+------------------------------------------------------------------+
   //| Verifica se já existe um pré-alerta para a vela                   |
   //+------------------------------------------------------------------+
   bool ExistsPreAlert(datetime time)
   {
      for(int i = 0; i < ArraySize(preAlerts); i++)
      {
         if(preAlerts[i].time == time)
            return true;
      }
      return false;
   }

   //+------------------------------------------------------------------+
   //| Verifica se uma vela é considerada "histórica" (fechada há tempo suficiente) |
   //+------------------------------------------------------------------+
   bool IsHistoricalCandle(datetime candleTime)
   {
      // Uma vela é considerada histórica se fechou há pelo menos 1 período
      return (candleTime < TimeCurrent() - PeriodSeconds());
   }

   //+------------------------------------------------------------------+
   //| Adiciona um novo pré-alerta                                       |
   //+------------------------------------------------------------------+
   void AddPreAlert(datetime time, double price, bool isCall)
   {
      // Se o pré-alerta já existe e estamos protegendo contra alterações em velas fechadas
      if(ProtectHistoricalSignals && ExistsPreAlert(time) && IsHistoricalCandle(time))
      {
         // Não sobrescrever pré-alertas em velas já fechadas
         Print("[Alma] Pré-alerta já existe em " + TimeToString(time) + " (vela fechada). Proteção ativa, não alterando.");
         return;
      }
      
      if(!ExistsPreAlert(time))
      {
         int size = ArraySize(preAlerts);
         ArrayResize(preAlerts, size + 1);
         preAlerts[size].time = time;
         preAlerts[size].price = price;
         preAlerts[size].isCall = isCall;
         preAlerts[size].converted = false;
         
         Print("[Alma] Novo pré-alerta adicionado em " + TimeToString(time) + ": " + 
                  (isCall ? "CALL" : "PUT") + " em " + DoubleToString(price, _Digits));
      }
   }

   //+------------------------------------------------------------------+
   //| Obtém um pré-alerta                                              |
   //+------------------------------------------------------------------+
   bool GetPreAlert(datetime time, PreAlertInfo &alert)
   {
      for(int i = 0; i < ArraySize(preAlerts); i++)
      {
         if(preAlerts[i].time == time)
         {
            alert = preAlerts[i];
            return true;
         }
      }
      return false;
   }

   //+------------------------------------------------------------------+
   //| Marca um pré-alerta como convertido                               |
   //+------------------------------------------------------------------+
   void SetPreAlertConverted(datetime time)
   {
      for(int i = 0; i < ArraySize(preAlerts); i++)
      {
         if(preAlerts[i].time == time)
         {
            preAlerts[i].converted = true;
            break;
         }
      }
   }

   //+------------------------------------------------------------------+
   //| Função para adicionar um novo sinal histórico                     |
   //+------------------------------------------------------------------+
   void AddHistoricalSignal(datetime time, double price, bool isCall, double openPrice, double closePrice, bool isClosed)
   {
      // Se o sinal já existe e estamos protegendo sinais históricos
      if(ProtectHistoricalSignals && ExistsHistoricalSignal(time) && IsHistoricalCandle(time))
      {
         // Não sobrescrever sinais em velas já fechadas
         Print("[Alma] Sinal já existe em " + TimeToString(time) + " (vela fechada). Proteção ativa, não alterando.");
         return;
      }
      
      if(!ExistsHistoricalSignal(time))
      {
         int size = ArraySize(historicalSignals);
         ArrayResize(historicalSignals, size + 1);
         historicalSignals[size].time = time;
         historicalSignals[size].price = price;
         historicalSignals[size].isCall = isCall;
         historicalSignals[size].openPrice = openPrice;
         historicalSignals[size].closePrice = closePrice;
         historicalSignals[size].isClosed = isClosed;
         
         // Se expiração em velas estiver ativada, calcular o tempo de expiração
         if(ExpiracaoVelas > 0)
         {
            // Obter a vela de expiração usando a atual + número de velas configurado
            int periodSeconds = PeriodSeconds();
            historicalSignals[size].expirationTime = time + (ExpiracaoVelas * periodSeconds);
            historicalSignals[size].expProcessed = false;
            historicalSignals[size].isWin = false; // Será definido na expiração
            
            Print("[Alma] Novo sinal adicionado em " + TimeToString(time) + " com expiração em " + 
                  TimeToString(historicalSignals[size].expirationTime) + ": " + 
                  (isCall ? "CALL" : "PUT") + " em " + DoubleToString(price, _Digits));
                  
            // IMPORTANTE: Mostrar o sinal imediatamente, sem esperar pela expiração
            MostrarSinalEntrada(historicalSignals[size]);
         }
         else
         {
            // Comportamento original para expiração na mesma vela
            historicalSignals[size].isWin = isClosed ? 
               (isCall ? closePrice > openPrice : closePrice < openPrice) : false;
            historicalSignals[size].expirationTime = time;
            historicalSignals[size].expProcessed = isClosed;
            
            Print("[Alma] Novo sinal adicionado em " + TimeToString(time) + ": " + 
                  (isCall ? "CALL" : "PUT") + " em " + DoubleToString(price, _Digits));
                  
            // CORREÇÃO: Registrar resultado quando o sinal for fechado
            if (isClosed) {
               if (historicalSignals[size].isWin)
                  totalWins++;
               else
                  totalLosses++;
               
               totalSinais = totalWins + totalLosses;
               
               // Calcular nova assertividade
               if(totalSinais > 0)
                  assertividade = (double)totalWins / totalSinais * 100.0;
               
               // Atualizar painel imediatamente após adicionar um sinal fechado
               if(MostrarPainel)
                  AtualizarPainel();
               
               Print("[Alma] Estatística atualizada: W:" + IntegerToString(totalWins) + 
                    " L:" + IntegerToString(totalLosses) + 
                    " Total:" + IntegerToString(totalSinais) + 
                    " Assert:" + DoubleToString(assertividade, 2) + "%");
            }
         }
      }
   }

   //+------------------------------------------------------------------+
   //| Obtém um sinal histórico                                          |
   //+------------------------------------------------------------------+
   bool GetHistoricalSignal(datetime time, SignalInfo &signal)
   {
      for(int i = 0; i < ArraySize(historicalSignals); i++)
      {
         if(historicalSignals[i].time == time)
         {
            signal = historicalSignals[i];
            return true;
         }
      }
      return false;
   }

   //+------------------------------------------------------------------+
   //| Atualiza um sinal histórico                                       |
   //+------------------------------------------------------------------+
   void UpdateHistoricalSignal(datetime time, double closePrice, bool isClosed)
   {
      for(int i = 0; i < ArraySize(historicalSignals); i++)
      {
         if(historicalSignals[i].time == time)
         {
            // Só atualizar se a vela ainda não estava marcada como fechada
            if(!historicalSignals[i].isClosed && isClosed)
            {
               Print("[Alma] CRÍTICO: Atualizando resultado para sinal em " + 
                     TimeToString(time) + " que acabou de fechar");

               historicalSignals[i].closePrice = closePrice;
               historicalSignals[i].isClosed = isClosed;
               
               // Atualizar o resultado apenas se expiração em velas estiver desativada
               if(ExpiracaoVelas <= 0)
               {
                  // Calcular se é win ou loss
                  bool isWin = historicalSignals[i].isCall ? 
                     (closePrice > historicalSignals[i].openPrice) : 
                     (closePrice < historicalSignals[i].openPrice);
                     
                  // Atualizar contadores
                  if(isWin)
                     totalWins++;
                  else
                     totalLosses++;
                     
                  // Atualizar totais e assertividade
                  totalSinais = totalWins + totalLosses;
                  if(totalSinais > 0)
                     assertividade = (double)totalWins / totalSinais * 100.0;
                  
                  // Definir resultado no objeto
                  historicalSignals[i].isWin = isWin;
                  
                  Print("[Alma] RESULTADO REGISTRADO: " + (historicalSignals[i].isCall ? "CALL" : "PUT") + 
                       " em " + TimeToString(time) + ": " + (isWin ? "WIN" : "LOSS") + 
                       " - Estatísticas atualizadas: W:" + IntegerToString(totalWins) + 
                       ", L:" + IntegerToString(totalLosses) + 
                       ", Total:" + IntegerToString(totalSinais) + 
                       ", Assert:" + DoubleToString(assertividade, 2) + "%");
                  
                  // Atualizar o painel imediatamente
                  if(MostrarPainel)
                     AtualizarPainel();
               }
            }
            break;
         }
      }
   }

   //+------------------------------------------------------------------+
   //| Função para verificar se o sinal deve ser filtrado pelo intervalo |
   //+------------------------------------------------------------------+
   bool DevePermitirSinal(datetime tempoAtual, const datetime &time[])
   {
      // Se o filtro está desativado, sempre permite o sinal
      if(IntervaloVelas <= 0)
         return true;
         
      // Se é o primeiro sinal (nenhum sinal anterior), permite
      if(ultimoTempoSinal == 0)
      {
         Print("[Alma] Primeiro sinal detectado em " + TimeToString(tempoAtual) + " - permitido");
         return true;
      }
      
      // Encontrar a posição da última vela com sinal e da vela atual no array de tempos
      int posUltimoSinal = -1;
      int posAtual = -1;
      
      for(int i = 0; i < ArraySize(time); i++)
      {
         if(time[i] == ultimoTempoSinal)
            posUltimoSinal = i;
            
         if(time[i] == tempoAtual)
            posAtual = i;
            
         if(posUltimoSinal >= 0 && posAtual >= 0)
            break;
      }
      
      // Se não encontramos as posições, permitir o sinal (algo pode estar errado, melhor não bloquear)
      if(posUltimoSinal < 0 || posAtual < 0)
      {
         Print("[Alma AVISO] Posição das velas não encontrada: ultimo=" + TimeToString(ultimoTempoSinal) + 
               ", atual=" + TimeToString(tempoAtual) + " - permitindo sinal");
         return true;
      }
      
      // Calcular quantas velas se passaram (lembrar que os índices estão em ordem decrescente!)
      int velasPassadas = posUltimoSinal - posAtual;
      
      Print("[Alma] Verificação de intervalo: último sinal=" + TimeToString(ultimoTempoSinal) + 
            " (pos " + IntegerToString(posUltimoSinal) + "), atual=" + TimeToString(tempoAtual) + 
            " (pos " + IntegerToString(posAtual) + "), velas passadas=" + IntegerToString(velasPassadas) + 
            ", configurado=" + IntegerToString(IntervaloVelas));
      
      // Verificar se já passaram velas suficientes
      bool permitir = velasPassadas > IntervaloVelas;
      
      if(permitir)
         Print("[Alma] Sinal PERMITIDO - intervalo de " + IntegerToString(velasPassadas) + 
               " velas > " + IntegerToString(IntervaloVelas) + " configurado");
      else
         Print("[Alma] Sinal BLOQUEADO - intervalo de " + IntegerToString(velasPassadas) + 
               " velas < " + IntegerToString(IntervaloVelas) + " configurado");
         
      return permitir;
   }

   //+------------------------------------------------------------------+
   //| Função para verificar se o pré-alerta deve ser filtrado pelo intervalo |
   //+------------------------------------------------------------------+
   bool DevePermitirPreAlerta(datetime tempoAtual, const datetime &time[])
   {
      // Nova regra: Se pré-alertas estão ativados e intervalo=0, forçar intervalo mínimo de 1 vela
      int intervaloMinimo = IntervaloVelas;
      if(UsePreAlertas && IntervaloVelas == 0 && IntervaloPreAlertas)
      {
         intervaloMinimo = 1; // Forçar intervalo mínimo de 1 vela para pré-alertas
         static bool avisoExibido = false;
         if(!avisoExibido)
         {
            Print("[Alma] AVISO: IntervaloVelas=0 com UsePreAlertas=true - Aplicando intervalo mínimo de 1 vela para pré-alertas");
            avisoExibido = true;
         }
      }
      
      // Se o filtro está desativado ou não aplicável aos pré-alertas, sempre permite
      if(intervaloMinimo <= 0 || !IntervaloPreAlertas)
         return true;
         
      // Se é o primeiro pré-alerta (nenhum anterior), permite
      if(ultimoTempoPreAlerta == 0)
      {
         Print("[Alma] Primeiro pré-alerta detectado em " + TimeToString(tempoAtual) + " - permitido");
         return true;
      }
      
      // Encontrar a posição do último pré-alerta e da vela atual no array de tempos
      int posUltimoPreAlerta = -1;
      int posAtual = -1;
      
      for(int i = 0; i < ArraySize(time); i++)
      {
         if(time[i] == ultimoTempoPreAlerta)
            posUltimoPreAlerta = i;
            
         if(time[i] == tempoAtual)
            posAtual = i;
            
         if(posUltimoPreAlerta >= 0 && posAtual >= 0)
            break;
      }
      
      // Se não encontramos as posições, permitir (algo pode estar errado, melhor não bloquear)
      if(posUltimoPreAlerta < 0 || posAtual < 0)
      {
         Print("[Alma AVISO] Posição das velas para pré-alerta não encontrada: ultimo=" + 
               TimeToString(ultimoTempoPreAlerta) + ", atual=" + TimeToString(tempoAtual) + 
               " - permitindo pré-alerta");
         return true;
      }
      
      // Calcular quantas velas se passaram (lembrar que os índices estão em ordem decrescente!)
      int velasPassadas = posUltimoPreAlerta - posAtual;
      
      // Verificar se já passaram velas suficientes (usando o intervalo mínimo calculado)
      bool permitir = velasPassadas > intervaloMinimo;
      
      if(!permitir)
         Print("[Alma] Pré-alerta BLOQUEADO - intervalo de " + IntegerToString(velasPassadas) + 
               " velas < " + IntegerToString(intervaloMinimo) + 
               (intervaloMinimo != IntervaloVelas ? " (intervalo mínimo forçado)" : " configurado"));
         
      return permitir;
   }

   //+------------------------------------------------------------------+
   //| Verifica se a vela deve ser processada de acordo com as opções de backtest |
   //+------------------------------------------------------------------+
   bool DeveProcessarVela(int indice, bool isClosed, bool temSinal=false)
   {
      // CORREÇÃO: Permitir que o índice 0 (vela atual) seja sempre processado quando VelasAtuais=true
      if (indice == 0 && VelasAtuais)
         return true;
         
      // CORREÇÃO CRÍTICA: Se a vela já tem um sinal registrado, sempre processar
      // para garantir que o resultado seja atualizado quando ela fechar
      if (temSinal)
         return true;
      
      // Verificar se devemos processar esta vela baseado nas configurações de backtest
      if(isClosed) // Vela fechada (passada)
         return VelasPassadas;
      else // Vela atual (não fechada) ou futura
         return VelasAtuais;
   }

   //+------------------------------------------------------------------+
   //| Função para processar pré-alertas pendentes em uma nova vela      |
   //+------------------------------------------------------------------+
   void ProcessarPreAlertasPendentes(const datetime &time[], 
                                    const double &open[],
                                    const double &high[],
                                    const double &low[],
                                    const double &close[])
   {
      datetime currentTime = TimeCurrent();
      
      // Verificar todos os pré-alertas não convertidos
      for(int i = 0; i < ArraySize(preAlerts); i++)
      {
         if(!preAlerts[i].converted)
         {
            // Encontrar a vela que segue o pré-alerta
            for(int j = 0; j < ArraySize(time); j++)
            {
               // Se encontrarmos a vela do pré-alerta
               if(time[j] == preAlerts[i].time)
               {
                  // A próxima vela (j-1) é a vela onde queremos gerar o sinal
                  if(j > 0 && !ExistsHistoricalSignal(time[j-1]) && 
                     DeveProcessarVela(j-1, time[j-1] < currentTime - PeriodSeconds()))
                  {
                     double entryPrice = preAlerts[i].isCall ? 
                                       low[j-1] - (5 * _Point) : 
                                       high[j-1] + (5 * _Point);
                     
                     // Adicionar sinal imediatamente
                     AddHistoricalSignal(time[j-1], entryPrice, preAlerts[i].isCall, 
                                       open[j-1], close[j-1], 
                                       time[j-1] < currentTime - PeriodSeconds());
                     
                     Print("[Alma] Pré-alerta convertido em sinal INSTANTÂNEO na vela ", 
                           TimeToString(time[j-1]));
                     
                     // Marcar pré-alerta como convertido
                     preAlerts[i].converted = true;
                     
                     // Atualizar último tempo de sinal
                     ultimoTempoSinal = time[j-1];
                     break;
                  }
               }
            }
         }
      }
   }

   //+------------------------------------------------------------------+
   //| Função de iteração do indicador customizado                        |
   //+------------------------------------------------------------------+
   int OnCalculate(const int rates_total,
                  const int prev_calculated,
                  const datetime &time[],
                  const double &open[],
                  const double &high[],
                  const double &low[],
                  const double &close[],
                  const long &tick_volume[],
                  const long &volume[],
                  const int &spread[])
   {
      if(rates_total < 2) return(0);
      
      // NOVA VERIFICAÇÃO: Detectar se VelasPassadas mudou para false
      if(UltimoVelasPassadas == true && VelasPassadas == false)
      {
         Print("[Alma] Detectada mudança em VelasPassadas: true -> false");
         ResetarEstatisticas();
      }
      // Atualizar o rastreamento
      UltimoVelasPassadas = VelasPassadas;
      
      ArraySetAsSeries(open, true);
      ArraySetAsSeries(high, true);
      ArraySetAsSeries(low, true);
      ArraySetAsSeries(close, true);
      ArraySetAsSeries(time, true);
      
      // Detectar nova vela
      bool novaVelaAberta = (time[0] != lastProcessedBarTime);
      
      // Se uma nova vela foi aberta, processar imediatamente os pré-alertas pendentes
      if(novaVelaAberta && lastProcessedBarTime != 0)
      {
         Print("[Alma] Nova vela detectada em ", TimeToString(time[0]), 
               " - Processando pré-alertas pendentes imediatamente");
         ProcessarPreAlertasPendentes(time, open, high, low, close);
      }
      
      // Armazenar o tempo da vela atual para detecção de novas velas
      lastProcessedBarTime = time[0];
      
      int limit = (prev_calculated > 0) ? prev_calculated - 1 : rates_total - 1;
      if(limit > AnalyzedCandles) limit = AnalyzedCandles;
      
      // MELHORIA: Inicializar TODOS os buffers do indicador com EMPTY_VALUE
      // Isso impede que valores antigos permaneçam visíveis além do limite
      for(int i = 0; i < rates_total; i++)
      {
         SignalCallBuffer[i] = EMPTY_VALUE;
         SignalPutBuffer[i] = EMPTY_VALUE;
         PreCallBuffer[i] = EMPTY_VALUE;
         PrePutBuffer[i] = EMPTY_VALUE;
      }
      
      // MELHORIA: Remover objetos visuais que estejam além do limite de AnalyzedCandles
      if(prev_calculated <= 1) // Executar apenas na inicialização ou recálculo completo
      {
         // Obter a data limite baseada em AnalyzedCandles
         datetime limitTime = time[AnalyzedCandles < rates_total ? AnalyzedCandles : (rates_total - 1)];
         RemoverSinaisAntigos(limitTime);
      }
      
      // Log inicial do ciclo
      if(prev_calculated <= 1)
      {
         Print("===============================================");
         Print("[Alma] Inicio de novo ciclo de cálculo: " + TimeToString(TimeCurrent()));
         Print("[Alma] Modo: " + (RequireConfluence ? "CONFLUÊNCIA (automático)" : "NORMAL (automático)"));
         Print("[Alma] Backtest: Velas Passadas=" + (VelasPassadas ? "ATIVADO" : "DESATIVADO") + 
               ", Velas Atuais=" + (VelasAtuais ? "ATIVADO" : "DESATIVADO"));
         Print("[Alma] Pré-Alertas: " + (UsePreAlertas ? "ATIVADO" : "DESATIVADO"));
         Print("[Alma] Intervalo de velas: " + (IntervaloVelas > 0 ? IntegerToString(IntervaloVelas) : "DESATIVADO"));
         if(ultimoTempoSinal > 0)
            Print("[Alma] Último sinal: " + TimeToString(ultimoTempoSinal));
         if(ultimoTempoPreAlerta > 0)
            Print("[Alma] Último pré-alerta: " + TimeToString(ultimoTempoPreAlerta));
         Print("===============================================");
      }
      
      // PARTE CRÍTICA: LEITURA DOS BUFFERS
      bool ind1Loaded = false;
      bool ind2Loaded = false;
      
      // Copiar dados do indicador 1
      if(UseExternalInd1)
      {
         // Preparar buffers
         ArrayResize(extCallValues1, rates_total);
         ArrayResize(extPutValues1, rates_total);
         ArraySetAsSeries(extCallValues1, true);
         ArraySetAsSeries(extPutValues1, true);
         ArrayInitialize(extCallValues1, EMPTY_VALUE);
         ArrayInitialize(extPutValues1, EMPTY_VALUE);
         
         // Copiar dados dos buffers
         int copied_call = CopyBuffer(externalHandle1, ExtCallBufferIndex1, 0, rates_total, extCallValues1);
         int copied_put = CopyBuffer(externalHandle1, ExtPutBufferIndex1, 0, rates_total, extPutValues1);
         
         // Verificar se os dados foram copiados com sucesso
         if(copied_call <= 0)
         {
            Print("[Alma ERRO] Falha ao copiar buffer CALL do indicador 1. Erro: " + IntegerToString(GetLastError()));
         }
         else if(copied_put <= 0)
         {
            Print("[Alma ERRO] Falha ao copiar buffer PUT do indicador 1. Erro: " + IntegerToString(GetLastError()));
         }
         else
         {
            ind1Loaded = true;
            if(ShowDebugInfo && prev_calculated <= 1)
            {
               Print("[Alma] Dados do indicador 1 copiados com sucesso");
            }
         }
      }
      
      // Copiar dados do indicador 2
      if(UseExternalInd2)
      {
         // Preparar buffers
         ArrayResize(extCallValues2, rates_total);
         ArrayResize(extPutValues2, rates_total);
         ArraySetAsSeries(extCallValues2, true);
         ArraySetAsSeries(extPutValues2, true);
         ArrayInitialize(extCallValues2, EMPTY_VALUE);
         ArrayInitialize(extPutValues2, EMPTY_VALUE);
         
         // Copiar dados dos buffers
         int copied_call = CopyBuffer(externalHandle2, ExtCallBufferIndex2, 0, rates_total, extCallValues2);
         int copied_put = CopyBuffer(externalHandle2, ExtPutBufferIndex2, 0, rates_total, extPutValues2);
         
         // Verificar se os dados foram copiados com sucesso
         if(copied_call <= 0)
         {
            Print("[Alma ERRO] Falha ao copiar buffer CALL do indicador 2. Erro: " + IntegerToString(GetLastError()));
         }
         else if(copied_put <= 0)
         {
            Print("[Alma ERRO] Falha ao copiar buffer PUT do indicador 2. Erro: " + IntegerToString(GetLastError()));
         }
         else
         {
            ind2Loaded = true;
            if(ShowDebugInfo && prev_calculated <= 1)
            {
               Print("[Alma] Dados do indicador 2 copiados com sucesso");
            }
         }
      }
      
      datetime currentTime = TimeCurrent();
      
      // Processar expirações de sinais (nova função)
      ProcessarExpiracoes(time, open, close);
      
      // LOOP PRINCIPAL - PROCESSAMENTO DAS VELAS
      for(int i = limit; i >= 0; i--)
      {
         bool isClosed = time[i] < currentTime - PeriodSeconds();
         
         // Verificar se existe sinal histórico antes de decidir processar ou não
         bool temSinalHistorico = ExistsHistoricalSignal(time[i]);
         
         // DEPURAÇÃO ADICIONAL para vela atual ou velas com sinais
         if(i == 0 || temSinalHistorico)
         {
            Print("[Alma] Processando vela em " + TimeToString(time[i]) + 
                  ", índice=" + IntegerToString(i) +
                  ", fechada=" + (isClosed ? "SIM" : "NÃO") + 
                  ", temSinal=" + (temSinalHistorico ? "SIM" : "NÃO") +
                  ", será processada=" + (DeveProcessarVela(i, isClosed, temSinalHistorico) ? "SIM" : "NÃO"));
         }
         
         // CORREÇÃO CRÍTICA: Sempre processar velas com sinais, independente das configurações
         if(!DeveProcessarVela(i, isClosed, temSinalHistorico))
            continue;
         
         // Verifica se existe sinal histórico
         SignalInfo historicalSignal;
         if(GetHistoricalSignal(time[i], historicalSignal))
         {
            // Se o candle fechou e ainda não foi marcado como fechado
            if(isClosed && !historicalSignal.isClosed)
            {
               // Log detalhado para depuração
               Print("[Alma] Atualizando sinal em vela recém-fechada: " + TimeToString(time[i]) + 
                     " - Sinal: " + (historicalSignal.isCall ? "CALL" : "PUT"));
                     
               UpdateHistoricalSignal(time[i], close[i], true);
               
               // Atualizar a cópia local para uso abaixo
               historicalSignal.closePrice = close[i];
               historicalSignal.isClosed = true;
               
               // Atualizar resultado apenas se não estiver usando expiração em velas
               if(ExpiracaoVelas <= 0)
               {
                  historicalSignal.isWin = historicalSignal.isCall ? 
                     (close[i] > historicalSignal.openPrice) : 
                     (close[i] < historicalSignal.openPrice);
               }
            }
            
            // Se expiração em velas está desativada, mostrar resultado normalmente
            if(ExpiracaoVelas <= 0)
            {
               if(historicalSignal.isCall)
               {
                  CreateWinLossIcon("WinLoss_Call_" + IntegerToString(i), 
                                 time[i], 
                                 historicalSignal.price, 
                                 historicalSignal.isClosed ? historicalSignal.isWin : 
                                 (close[i] > historicalSignal.openPrice));
               }
               else
               {
                  CreateWinLossIcon("WinLoss_Put_" + IntegerToString(i), 
                                 time[i], 
                                 historicalSignal.price, 
                                 historicalSignal.isClosed ? historicalSignal.isWin : 
                                 (close[i] < historicalSignal.openPrice));
               }
            }
            continue;
         }
         
         // Verificar se existe pré-alerta para a vela
         PreAlertInfo preAlert;
         if(GetPreAlert(time[i], preAlert))
         {
            // Mostrar o pré-alerta nos buffers
            if(preAlert.isCall)
               PreCallBuffer[i] = preAlert.price;
            else
               PrePutBuffer[i] = preAlert.price;
            
            // Verificar se o pré-alerta se transformou em entrada (próxima vela)
            // Manter esta lógica como backup, mas a detecção principal agora é na abertura da vela
            bool canConvert = i > 0 && time[i] < currentTime - PeriodSeconds() && !preAlert.converted;
            if(canConvert)
            {
               // A vela do pré-alerta já fechou, criar entrada na próxima vela
               SetPreAlertConverted(time[i]);
               
               // Adicionar sinal na próxima vela (índice i-1)
               if(!ExistsHistoricalSignal(time[i-1]) && DeveProcessarVela(i-1, time[i-1] < currentTime - PeriodSeconds()))
               {
                  double entryPrice = preAlert.isCall ? low[i-1] - (5 * _Point) : high[i-1] + (5 * _Point);
                  AddHistoricalSignal(time[i-1], entryPrice, preAlert.isCall, open[i-1], close[i-1], 
                                    time[i-1] < currentTime - PeriodSeconds());
                  
                  Print("[Alma] Pré-alerta convertido em sinal na vela " + TimeToString(time[i-1]));
                  
                  // Atualizar último tempo de sinal
                  ultimoTempoSinal = time[i-1];
               }
            }
            
            continue;
         }
         
         // VERIFICAÇÃO DE SINAIS NOS INDICADORES
         bool hasCall1 = false;
         bool hasPut1 = false;
         bool hasCall2 = false;  
         bool hasPut2 = false;
         
         // CORREÇÃO CRÍTICA: Novos testes específicos para buffer CALL contendo preços
         if(ind1Loaded)
         {
            // Verificar se temos um sinal de PUT = 1.0
            bool putIs1 = MathAbs(extPutValues1[i] - 1.0) < 0.000001;
            
            if(putIs1 && PriceInCallBuffer)
            {
               // Se PUT=1.0 e CALL contém preço, isso é um padrão especial
               // Não considere como conflito, ative apenas o PUT
               hasCall1 = false;  // Ignorar o CALL independente do valor
               hasPut1 = true;    // Ativar o PUT
               
               if(i < 5) Print("[Alma] Padrão especial detectado no indicador 1: PUT=1.0 + CALL contém preço");
            }
            else
            {
               // Comportamento padrão para outros casos
               hasCall1 = IsValidSignalValue(extCallValues1[i]);
               hasPut1 = IsValidSignalValue(extPutValues1[i]);
            }
         }
         
         if(ind2Loaded)
         {
            // Verificar se temos um sinal de PUT = 1.0
            bool putIs1 = MathAbs(extPutValues2[i] - 1.0) < 0.000001;
            
            if(putIs1 && PriceInCallBuffer)
            {
               // Se PUT=1.0 e CALL contém preço, isso é um padrão especial
               // Não considere como conflito, ative apenas o PUT
               hasCall2 = false;  // Ignorar o CALL independente do valor
               hasPut2 = true;    // Ativar o PUT
               
               if(i < 5) Print("[Alma] Padrão especial detectado no indicador 2: PUT=1.0 + CALL contém preço");
            }
            else
            {
               // Comportamento padrão para outros casos
               hasCall2 = IsValidSignalValue(extCallValues2[i]);
               hasPut2 = IsValidSignalValue(extPutValues2[i]);
            }
         }
         
         // DETECÇÃO DE PADRÕES ESPECIAIS com PUT=1.0
         if(ind1Loaded && MathAbs(extPutValues1[i] - 1.0) < 0.000001)
         {
            if(i < 5) Print("[Alma] Valor 1.0 detectado em PUT do indicador 1, vela " + TimeToString(time[i]));
         }
         
         if(ind2Loaded && MathAbs(extPutValues2[i] - 1.0) < 0.000001)
         {
            if(i < 5) Print("[Alma] Valor 1.0 detectado em PUT do indicador 2, vela " + TimeToString(time[i]));
         }
         
         // DETECTAR INDICADORES COM SINAIS CONFLITANTES
         // CORREÇÃO: Se PriceInCallBuffer=true, não considerar isso como conflito
         bool ind1Conflicting = hasCall1 && hasPut1;
         bool ind2Conflicting = hasCall2 && hasPut2;
         
         // Se os buffers CALL contêm preços, nunca considere como conflito
         if(PriceInCallBuffer)
         {
            ind1Conflicting = false;
            ind2Conflicting = false;
         }
         
         // Registrar indicadores com conflitos internos
         if(i < 5)
         {
            if(ind1Conflicting)
               Print("[Alma AVISO] Indicador 1 com sinais conflitantes na vela " + TimeToString(time[i]));
            
            if(ind2Conflicting)
               Print("[Alma AVISO] Indicador 2 com sinais conflitantes na vela " + TimeToString(time[i]));
         }
         
         // REGRA: Ignorar indicadores conflitantes se IgnoreMultiSignals=true
         if(IgnoreMultiSignals)
         {
            if(ind1Conflicting)
            {
               hasCall1 = false;
               hasPut1 = false;
               if(i < 5) Print("[Alma] Ignorando sinais do indicador 1 devido a conflito interno");
            }
            
            if(ind2Conflicting)
            {
               hasCall2 = false;
               hasPut2 = false;
               if(i < 5) Print("[Alma] Ignorando sinais do indicador 2 devido a conflito interno");
            }
         }
         
         // LÓGICA DE GERAÇÃO DE SINAIS
         bool generateCall = false;
         bool generatePut = false;
         
         // Variáveis para rastreamento de sinais para próxima vela
         bool nextCandleCall = false;
         bool nextCandlePut = false;
         
         // NOTA: RequireConfluence é definido automaticamente com base nos indicadores ativos
         if(RequireConfluence) // Modo de confluência - ambos indicadores devem concordar
         {
            if(ind1Loaded && ind2Loaded) // Ambos indicadores carregados
            {
               // Verificação rigorosa de confluência
               if(hasCall1 && hasCall2) 
               {
                  // CORREÇÃO: Se ambos indicadores ativam próxima vela, não gerar na vela atual
                  if(NextCandleEntry1 && NextCandleEntry2)
                  {
                     nextCandleCall = true;
                     if(i < 5) Print("[Alma] Vela " + TimeToString(time[i]) + 
                              " - Confluência CALL para PRÓXIMA vela");
                  }
                  else if(NextCandleEntry1 || NextCandleEntry2)
                  {
                     // Se apenas um dos indicadores ativa próxima vela,
                     // seguimos a regra de próxima vela (comportamento mais seguro)
                     nextCandleCall = true;
                     if(i < 5) Print("[Alma] Vela " + TimeToString(time[i]) + 
                              " - Confluência CALL para PRÓXIMA vela (via regra de segurança)");
                  }
                  else
                  {
                     // Nenhum indicador solicita próxima vela, gerar na vela atual
                     generateCall = true;
                     if(i < 5) Print("[Alma] Vela " + TimeToString(time[i]) + " - Confluência CALL confirmada");
                  }
               }
               
               if(hasPut1 && hasPut2)
               {
                  // CORREÇÃO: Se ambos indicadores ativam próxima vela, não gerar na vela atual
                  if(NextCandleEntry1 && NextCandleEntry2)
                  {
                     nextCandlePut = true;
                     if(i < 5) Print("[Alma] Vela " + TimeToString(time[i]) + 
                              " - Confluência PUT para PRÓXIMA vela");
                  }
                  else if(NextCandleEntry1 || NextCandleEntry2)
                  {
                     // Se apenas um dos indicadores ativa próxima vela,
                     // seguimos a regra de próxima vela (comportamento mais seguro)
                     nextCandlePut = true;
                     if(i < 5) Print("[Alma] Vela " + TimeToString(time[i]) + 
                              " - Confluência PUT para PRÓXIMA vela (via regra de segurança)");
                  }
                  else
                  {
                     // Nenhum indicador solicita próxima vela, gerar na vela atual
                     generatePut = true;
                     if(i < 5) Print("[Alma] Vela " + TimeToString(time[i]) + " - Confluência PUT confirmada");
                  }
               }
               
               // Mensagem quando NÃO houver confluência
               if(i < 5 && !generateCall && !generatePut)
               {
                  if(hasCall1 || hasCall2 || hasPut1 || hasPut2)
                     Print("[Alma] Vela " + TimeToString(time[i]) + 
                           " - Sem confluência: ind1[CALL=" + (hasCall1 ? "SIM" : "NÃO") + 
                           ",PUT=" + (hasPut1 ? "SIM" : "NÃO") + "], ind2[CALL=" + 
                           (hasCall2 ? "SIM" : "NÃO") + ",PUT=" + (hasPut2 ? "SIM" : "NÃO") + "]");
               }
            }
         }
         else // Modo normal - qualquer indicador pode gerar sinais
         {
            if(ind1Loaded && !ind2Loaded) // Apenas indicador 1 está carregado
            {
               // CORREÇÃO: Verificar se o indicador 1 deve gerar sinal na próxima vela
               if(NextCandleEntry1)
               {
                  // Se sim, apenas definir os sinais para próxima vela
                  nextCandleCall = hasCall1;
                  nextCandlePut = hasPut1;
                  // NÃO definir generateCall ou generatePut para evitar sinal na vela atual
               }
               else
               {
                  // Caso contrário, gerar na vela atual como antes
                  generateCall = hasCall1;
                  generatePut = hasPut1;
               }
            }
            else if(!ind1Loaded && ind2Loaded) // Apenas indicador 2 está carregado
            {
               // CORREÇÃO: Verificar se o indicador 2 deve gerar sinal na próxima vela
               if(NextCandleEntry2)
               {
                  // Se sim, apenas definir os sinais para próxima vela
                  nextCandleCall = hasCall2;
                  nextCandlePut = hasPut2;
                  // NÃO definir generateCall ou generatePut para evitar sinal na vela atual
               }
               else
               {
                  // Caso contrário, gerar na vela atual como antes
                  generateCall = hasCall2;
                  generatePut = hasPut2;
               }
            }
            else if(ind1Loaded && ind2Loaded) // Ambos indicadores carregados
            {
               // Com ambos indicadores, mas sem exigir confluência
               // CORREÇÃO: Para cada indicador, verificar se deve gerar na mesma ou próxima vela
               
               // Inicializar todos como falso
               generateCall = false;
               generatePut = false;
               nextCandleCall = false;
               nextCandlePut = false;
               
               // Processar indicador 1
               if(NextCandleEntry1)
               {
                  // Indicador 1 envia para próxima vela
                  nextCandleCall = nextCandleCall || hasCall1;
                  nextCandlePut = nextCandlePut || hasPut1;
               }
               else
               {
                  // Indicador 1 gera na mesma vela
                  generateCall = generateCall || hasCall1;
                  generatePut = generatePut || hasPut1;
               }
               
               // Processar indicador 2
               if(NextCandleEntry2)
               {
                  // Indicador 2 envia para próxima vela
                  nextCandleCall = nextCandleCall || hasCall2;
                  nextCandlePut = nextCandlePut || hasPut2;
               }
               else
               {
                  // Indicador 2 gera na mesma vela
                  generateCall = generateCall || hasCall2;
                  generatePut = generatePut || hasPut2;
               }
            }
         }
         
         // RESOLUÇÃO DE CONFLITOS ENTRE CALL E PUT
         if(generateCall && generatePut)
         {
            // Temos um conflito CALL/PUT na mesma vela
            if(i < 10) Print("[Alma] Conflito na vela " + TimeToString(time[i]) + ": CALL e PUT detectados simultaneamente");
            
            // Aplicar regra de prioridade (SignalPriority está definido internamente como 0 - ignorar ambos)
            generateCall = false;
            generatePut = false;
            if(i < 10) Print("[Alma] Ignorando ambos os sinais devido a conflito");
         }
         
         // Mesmo para próxima vela, verificar conflitos
         if(nextCandleCall && nextCandlePut)
         {
            if(i < 10) Print("[Alma] Conflito na PRÓXIMA vela após " + TimeToString(time[i]) + 
                           ": CALL e PUT detectados simultaneamente");
            
            nextCandleCall = false;
            nextCandlePut = false;
            if(i < 10) Print("[Alma] Ignorando ambos os sinais para próxima vela devido a conflito");
         }
         
         // Se estamos usando o sistema de pré-alertas
         if(UsePreAlertas)
         {
            // Verificação para pré-alertas
            // No modo de backtest, permitimos pré-alertas em velas passadas também
            bool isBacktestMode = (VelasPassadas && isClosed) || (VelasAtuais && !isClosed);
            bool permitirPreAlerta = DevePermitirPreAlerta(time[i], time);
            
            // Gerar pré-alertas
            if(generatePut && permitirPreAlerta && !ExistsPreAlert(time[i]) && isBacktestMode)
            {
               double pricePrePut = high[i] + (5 * _Point);
               PrePutBuffer[i] = pricePrePut;
               
               // Adicionar pré-alerta
               AddPreAlert(time[i], pricePrePut, false);
               
               // Atualizar o tempo do último pré-alerta
               ultimoTempoPreAlerta = time[i];
               
               Print("[Alma] *** PRÉ-ALERTA PUT gerado na vela " + TimeToString(time[i]) + 
                     (isClosed ? " (backtest)" : "") + " ***");
            }
            else if(generateCall && permitirPreAlerta && !ExistsPreAlert(time[i]) && isBacktestMode)
            {
               double pricePreCall = low[i] - (5 * _Point);
               PreCallBuffer[i] = pricePreCall;
               
               // Adicionar pré-alerta
               AddPreAlert(time[i], pricePreCall, true);
               
               // Atualizar o tempo do último pré-alerta
               ultimoTempoPreAlerta = time[i];
               
               Print("[Alma] *** PRÉ-ALERTA CALL gerado na vela " + TimeToString(time[i]) + 
                     (isClosed ? " (backtest)" : "") + " ***");
            }
         }
         else // Sistema de geração direta de sinais (original)
         {
            // APLICAÇÃO DO FILTRO DE INTERVALO ENTRE SINAIS (usando datetimes)
            bool permitirSinal = DevePermitirSinal(time[i], time);
            
            // GERAÇÃO FINAL DOS SINAIS
            if(generatePut && permitirSinal)
            {
               double pricePut = high[i] + (5 * _Point);
               // REMOVIDA a atribuição ao buffer para evitar duplicação
               // SignalPutBuffer[i] = pricePut; // ATRIBUIÇÃO AO BUFFER PUT
               
               // Atualiza o tempo do último sinal permitido
               ultimoTempoSinal = time[i];
               
               Print("[Alma] *** SINAL PUT gerado na vela " + TimeToString(time[i]) + 
                     (isClosed ? " (backtest)" : "") + " ***");
                  
               AddHistoricalSignal(time[i], pricePut, false, open[i], close[i], isClosed);
               CreateWinLossIcon("WinLoss_Put_" + IntegerToString(i), 
                              time[i], 
                              pricePut, 
                              isClosed ? close[i] < open[i] : close[i] < open[i]);
               
               if(i == 0)
               {
                  lastSignalTime = time[0];
                  lastSignalType = 2; // PUT
               }
            }
            else if(generateCall && permitirSinal)
            {
               double priceCall = low[i] - (5 * _Point);
               // REMOVIDA a atribuição ao buffer para evitar duplicação
               // SignalCallBuffer[i] = priceCall; // ATRIBUIÇÃO AO BUFFER CALL
               
               // Atualiza o tempo do último sinal permitido
               ultimoTempoSinal = time[i];
               
               Print("[Alma] *** SINAL CALL gerado na vela " + TimeToString(time[i]) + 
                     (isClosed ? " (backtest)" : "") + " ***");
                  
               AddHistoricalSignal(time[i], priceCall, true, open[i], close[i], isClosed);
               CreateWinLossIcon("WinLoss_Call_" + IntegerToString(i), 
                              time[i], 
                              priceCall, 
                              isClosed ? close[i] > open[i] : close[i] > open[i]);
               
               if(i == 0)
               {
                  lastSignalTime = time[0];
                  lastSignalType = 1; // CALL
               }
            }
            else if((generateCall || generatePut) && !permitirSinal)
            {
               if(i < 10) 
                  Print("[Alma] Sinal bloqueado na vela " + TimeToString(time[i]) + 
                        " pelo filtro de intervalo (necessário " + IntegerToString(IntervaloVelas) + 
                        " vela(s) após o último sinal em " + TimeToString(ultimoTempoSinal) + ")");
            }
         }
         
         // Processar sinais para próxima vela
         if((nextCandleCall || nextCandlePut))
         {
            // CORREÇÃO: Remover a condição DeveProcessarVela para permitir sempre processar sinais futuros
            ProcessarSinalProximaVela(i, nextCandleCall, nextCandlePut, time, open, high, low, close);
         }
      }
      
      // Atualizar a posição dos ícones de pré-alerta se necessário
      AtualizarPosicaoPreAlertas(high, low);
      
      // Atualizar painel de backtest - CORREÇÃO: Recalcular estatísticas aqui
      if(MostrarPainel)
      {
         CalcularEstatisticas(); // Recalcular completamente
         AtualizarPainel();
      }
      
      ChartRedraw();
      return(rates_total);
   }

   //+------------------------------------------------------------------+
   //| NOVA FUNÇÃO: Remover sinais antigos que estão fora do limite     |
   //+------------------------------------------------------------------+
   void RemoverSinaisAntigos(datetime limitTime)
   {
      // Remover sinais históricos antigos
      for(int i = ArraySize(historicalSignals) - 1; i >= 0; i--)
      {
         if(historicalSignals[i].time < limitTime)
         {
            // Remover objetos visuais associados a este sinal
            string nameBase = (historicalSignals[i].isCall ? "WinLoss_Call_" : "WinLoss_Put_") + 
                              TimeToString(historicalSignals[i].time);
            
            ObjectDelete(0, nameBase);
            ObjectDelete(0, nameBase + "_Signal");
            
            // Se temos expiração em velas
            if(ExpiracaoVelas > 0)
            {
               string expName = (historicalSignals[i].isCall ? "WinLoss_Call_EXP_" : "WinLoss_Put_EXP_") + 
                               TimeToString(historicalSignals[i].expirationTime);
               
               ObjectDelete(0, expName);
               ObjectDelete(0, expName + "_TEMP");
            }
         }
      }
      
      // Remover pré-alertas antigos
      for(int i = ArraySize(preAlerts) - 1; i >= 0; i--)
      {
         if(preAlerts[i].time < limitTime)
         {
            string preAlertName = "PreAlert_" + TimeToString(preAlerts[i].time);
            ObjectDelete(0, preAlertName);
         }
      }
      
      Print("[Alma] Sinais e pré-alertas antigos removidos (limite: " + TimeToString(limitTime) + ")");
   }

   //+------------------------------------------------------------------+
   //| Criar apenas o ícone de sinal (seta)                             |
   //+------------------------------------------------------------------+
   void CreateSignalIcon(string name, datetime time, double price, bool isCall)
   {
      // Verificar se o objeto já existe
      bool objectExists = ObjectFind(0, name) >= 0;
      
      // Remove o objeto se ele já existe
      if(objectExists)
         ObjectDelete(0, name);
         
      // Criar o ícone de sinal (seta CALL ou PUT)
      if(!ObjectCreate(0, name, OBJ_ARROW, 0, time, price))
      {
         Print("[Alma ERRO] Falha ao criar objeto de sinal " + name + ". Erro: " + IntegerToString(GetLastError()));
         return;
      }
      
      // Configurar a seta para CALL ou PUT
      ObjectSetInteger(0, name, OBJPROP_ARROWCODE, isCall ? ARROW_CALL : ARROW_PUT);
      ObjectSetInteger(0, name, OBJPROP_COLOR, clrWhite);
      ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
      
      // Ajusta o ponto de ancoragem para a seta
      ObjectSetInteger(0, name, OBJPROP_ANCHOR, isCall ? ANCHOR_TOP : ANCHOR_BOTTOM);
   }

   //+------------------------------------------------------------------+
   //| Criar apenas o ícone de resultado (win/loss)                      |
   //+------------------------------------------------------------------+
   void CreateResultIcon(string name, datetime time, double price, bool isWin, bool isCall)
   {
      // Verificar se o objeto já existe
      bool objectExists = ObjectFind(0, name) >= 0;
      bool isTemporaryIcon = StringFind(name, "_TEMP") >= 0;
      
      // Para ícones temporários (velas de expiração ainda abertas), sempre permitir atualizações
      if(!isTemporaryIcon && ProtectHistoricalSignals && objectExists && IsHistoricalCandle(time))
      {
         // Obter cor atual para verificar se o resultado mudou
         color currentColor = (color)ObjectGetInteger(0, name, OBJPROP_COLOR);
         color newColor = isWin ? clrLime : clrRed;
         
         // Se a cor mudou e é uma vela histórica, não permitir a alteração
         if(currentColor != newColor)
         {
            Print("[Alma] Proteção: Tentativa de alterar resultado de sinal em vela fechada " + 
                  TimeToString(time) + " bloqueada.");
            return;
         }
      }
      
      // Remove o objeto se ele já existe
      if(objectExists)
         ObjectDelete(0, name);
         
      // Criar o ícone de resultado (WIN/LOSS)
      if(!ObjectCreate(0, name, OBJ_ARROW, 0, time, price))
      {
         Print("[Alma ERRO] Falha ao criar objeto de resultado " + name + ". Erro: " + IntegerToString(GetLastError()));
         return;
      }
      
      // Para ícones temporários, usar uma cor mais clara para indicar que não é definitivo
      if(isTemporaryIcon) {
         ObjectSetInteger(0, name, OBJPROP_ARROWCODE, isWin ? ICON_WIN : ICON_LOSS);
         ObjectSetInteger(0, name, OBJPROP_COLOR, isWin ? clrLimeGreen : clrOrangeRed); // Cores mais claras para temporário
         ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
         ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_DOT); // Estilo pontilhado para temporário
      } else {
         ObjectSetInteger(0, name, OBJPROP_ARROWCODE, isWin ? ICON_WIN : ICON_LOSS);
         ObjectSetInteger(0, name, OBJPROP_COLOR, isWin ? clrLime : clrRed); // Cores normais para definitivo
         ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
         ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_SOLID); // Estilo sólido para definitivo
      }
      
      // Ajusta o ponto de ancoragem para o ícone de resultado
      ObjectSetInteger(0, name, OBJPROP_ANCHOR, isCall ? ANCHOR_TOP : ANCHOR_BOTTOM);
   }

   //+------------------------------------------------------------------+
   //| Criar ícone de vitória/derrota                                    |
   //+------------------------------------------------------------------+
   void CreateWinLossIcon(string name, datetime time, double price, bool isWin)
   {
      // Verificar se o objeto já existe e se é uma vela histórica
      bool objectExists = ObjectFind(0, name) >= 0;
      
      // Se estamos protegendo sinais históricos, objetos existentes em velas fechadas não devem ser modificados
      if(ProtectHistoricalSignals && objectExists && IsHistoricalCandle(time))
      {
         // Obter cor atual para verificar se o resultado mudou (ganhou ou perdeu)
         color currentColor = (color)ObjectGetInteger(0, name, OBJPROP_COLOR);
         color newColor = isWin ? clrLime : clrRed;
         
         // Se a cor mudou e é uma vela histórica, não permitir a alteração
         if(currentColor != newColor)
         {
            Print("[Alma] Proteção: Tentativa de alterar resultado de sinal em vela fechada " + 
                  TimeToString(time) + " bloqueada.");
            return;
         }
      }
      
      // Se estamos usando expiração em velas, este método só deve ser usado para velas sem expiração
      if(ExpiracaoVelas > 0)
      {
         bool isExpName = StringFind(name, "_EXP_") >= 0;
         if(!isExpName)
         {
            // Para sinais com expiração, apenas criar o ícone de sinal na vela de entrada
            string signalName = name + "_Signal";
            CreateSignalIcon(signalName, time, price, StringFind(name, "Put") < 0);
            return;
         }
      }
      
      // Método original para casos sem expiração ou para o ícone de resultado na expiração
      
      // Remove qualquer objeto existente com o mesmo nome
      if(objectExists)
         ObjectDelete(0, name);
         
      // Nome para o ícone de sinal (seta)
      string signalName = name + "_Signal";
      
      // Remover o objeto de sinal se existir
      if(ObjectFind(0, signalName) >= 0)
         ObjectDelete(0, signalName);
         
      // Criar o ícone de sinal (seta CALL ou PUT)
      if(!ObjectCreate(0, signalName, OBJ_ARROW, 0, time, price))
      {
         Print("[Alma ERRO] Falha ao criar objeto de sinal " + signalName + ". Erro: " + IntegerToString(GetLastError()));
      }
      else
      {
         // Configurar a seta para CALL ou PUT
         ObjectSetInteger(0, signalName, OBJPROP_ARROWCODE, StringFind(name, "Put") >= 0 ? ARROW_PUT : ARROW_CALL);
         ObjectSetInteger(0, signalName, OBJPROP_COLOR, clrWhite);
         ObjectSetInteger(0, signalName, OBJPROP_WIDTH, 1);
         
         // Ajusta o ponto de ancoragem para a seta
         if(StringFind(name, "Put") >= 0)
            ObjectSetInteger(0, signalName, OBJPROP_ANCHOR, ANCHOR_BOTTOM);  // Para PUT
         else
            ObjectSetInteger(0, signalName, OBJPROP_ANCHOR, ANCHOR_TOP);     // Para CALL
      }
      
      // Criar o ícone de resultado (WIN/LOSS) exatamente na mesma posição
      if(!ObjectCreate(0, name, OBJ_ARROW, 0, time, price))
      {
         Print("[Alma ERRO] Falha ao criar objeto de resultado " + name + ". Erro: " + IntegerToString(GetLastError()));
         return;
      }
      
      ObjectSetInteger(0, name, OBJPROP_ARROWCODE, isWin ? ICON_WIN : ICON_LOSS);
      ObjectSetInteger(0, name, OBJPROP_COLOR, isWin ? clrLime : clrRed);
      ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
      
      // IMPORTANTE: Usar a mesma configuração de ancoragem do sinal para perfeita sobreposição
      if(StringFind(name, "Put") >= 0)
         ObjectSetInteger(0, name, OBJPROP_ANCHOR, ANCHOR_BOTTOM);  // Para PUT
      else
         ObjectSetInteger(0, name, OBJPROP_ANCHOR, ANCHOR_TOP);     // Para CALL
         
      // Define uma prioridade de desenho (Z-order) para garantir que o resultado fique em cima
      ObjectSetInteger(0, name, OBJPROP_ZORDER, 1);
      ObjectSetInteger(0, signalName, OBJPROP_ZORDER, 0);
   }

   //+------------------------------------------------------------------+
   //| Função para atualizar posição dos ícones de pré-alerta            |
   //+------------------------------------------------------------------+
   void AtualizarPosicaoPreAlertas(const double &high[], const double &low[])
   {
      for(int i = 0; i < ArraySize(preAlerts); i++)
      {
         // Se o pré-alerta já foi convertido, não precisamos ajustá-lo
         if(preAlerts[i].converted)
            continue;
            
         // Encontrar a barra atual que corresponde ao tempo do pré-alerta
         int barIndex = iBarShift(_Symbol, PERIOD_CURRENT, preAlerts[i].time);
         if(barIndex < 0)
            continue;  // Não encontrou a barra
         
         // Se a vela é histórica e estamos protegendo sinais antigos, não ajusta a posição
         if(ProtectHistoricalSignals && IsHistoricalCandle(preAlerts[i].time))
            continue;
            
         if(preAlerts[i].isCall)
         {
            // Se o preço desceu abaixo da posição do pré-alerta CALL
            if(low[barIndex] <= preAlerts[i].price)
            {
               // Ajustar para uma nova posição abaixo do preço atual
               preAlerts[i].price = low[barIndex] - (10 * _Point);
               
               // Atualizar o buffer de exibição
               if(barIndex < ArraySize(PreCallBuffer))
                  PreCallBuffer[barIndex] = preAlerts[i].price;
                  
               Print("[Alma] Pré-alerta CALL em " + TimeToString(preAlerts[i].time) + 
                     " ajustado para nova posição: " + DoubleToString(preAlerts[i].price, _Digits));
            }
         }
         else  // PUT
         {
            // Se o preço subiu acima da posição do pré-alerta PUT
            if(high[barIndex] >= preAlerts[i].price)
            {
               // Ajustar para uma nova posição acima do preço atual
               preAlerts[i].price = high[barIndex] + (10 * _Point);
               
               // Atualizar o buffer de exibição
               if(barIndex < ArraySize(PrePutBuffer))
                  PrePutBuffer[barIndex] = preAlerts[i].price;
                  
               Print("[Alma] Pré-alerta PUT em " + TimeToString(preAlerts[i].time) + 
                     " ajustado para nova posição: " + DoubleToString(preAlerts[i].price, _Digits));
            }
         }
      }
   }

   //+------------------------------------------------------------------+
   //| Função para processar expiração de sinais                         |
   //+------------------------------------------------------------------+
   void ProcessarExpiracoes(const datetime &time[], 
                           const double &open[],
                           const double &close[])
   {
      // Se a expiração em velas não está ativada, não precisa processar
      if(ExpiracaoVelas <= 0)
         return;
         
      datetime currentTime = TimeCurrent();
      bool estatisticasAtualizadas = false;
      
      for(int i = 0; i < ArraySize(historicalSignals); i++)
      {
         // Pular sinais já completamente processados (vela fechada e resultado registrado)
         if(historicalSignals[i].expProcessed)
            continue;
            
         // Pular sinais que ainda não chegaram no tempo de expiração
         if(historicalSignals[i].expirationTime > currentTime)
            continue;
            
         // Encontrar a vela de expiração
         int expBarIndex = iBarShift(_Symbol, PERIOD_CURRENT, historicalSignals[i].expirationTime);
         if(expBarIndex < 0)
            continue; // Vela não encontrada
            
         // Verificar se a vela de expiração já fechou
         bool expBarClosed = time[expBarIndex] < currentTime - PeriodSeconds();
         
         // CORREÇÃO: Processar sinais de expiração mesmo quando VelasPassadas=false
         // porque o sinal foi gerado quando a vela estava aberta
         bool deveProcessar = true;
         
         // NOVA LÓGICA: Comparar preço de abertura na ENTRADA com preço de fechamento na EXPIRAÇÃO
         // Em vez de comparar open/close da vela de expiração
         bool isCurrentlyWin = historicalSignals[i].isCall ? 
                             (close[expBarIndex] > historicalSignals[i].openPrice) : 
                             (close[expBarIndex] < historicalSignals[i].openPrice);
         
         // CORREÇÃO: Criar nome para o objeto de resultado
         string resultName = (historicalSignals[i].isCall ? "WinLoss_Call_EXP_" : "WinLoss_Put_EXP_") + 
                          TimeToString(historicalSignals[i].expirationTime);
         
         // Se a vela fechou, registrar o resultado final
         if(expBarClosed) {
            if (!historicalSignals[i].expProcessed) {
               // CORREÇÃO: Atualizar contadores apenas se não foi processado antes
               historicalSignals[i].isWin = isCurrentlyWin;
               historicalSignals[i].expProcessed = true;
               
               // Incrementar os contadores de resultado
               if (isCurrentlyWin)
                  totalWins++;
               else
                  totalLosses++;
               
               estatisticasAtualizadas = true;
               
               Print("[Alma] Resultado FINAL na expiração. Vela origem: " + TimeToString(historicalSignals[i].time) + 
                     ", Vela expiração: " + TimeToString(historicalSignals[i].expirationTime) + 
                     ", Resultado: " + (historicalSignals[i].isWin ? "WIN" : "LOSS") +
                     ", Comparação: " + (historicalSignals[i].isCall ? "CALL" : "PUT") + 
                     " Abertura=" + DoubleToString(historicalSignals[i].openPrice, _Digits) +
                     " vs Fechamento=" + DoubleToString(close[expBarIndex], _Digits));
            }
         }
         else {
            // Se a vela ainda está aberta, mostrar resultado temporário
            Print("[Alma] Resultado TEMPORÁRIO na expiração. Vela origem: " + TimeToString(historicalSignals[i].time) + 
                  ", Vela expiração: " + TimeToString(historicalSignals[i].expirationTime) + 
                  ", Status atual: " + (isCurrentlyWin ? "WIN" : "LOSS") +
                  ", Comparação: " + (historicalSignals[i].isCall ? "CALL" : "PUT") +
                  " Abertura=" + DoubleToString(historicalSignals[i].openPrice, _Digits) +
                  " vs Fechamento atual=" + DoubleToString(close[expBarIndex], _Digits));
         }
         
         // Criar ou atualizar o ícone de resultado na vela de expiração
         // Nome especial para objetos temporários com sufixo diferente
         string displayName = resultName + (expBarClosed ? "" : "_TEMP");
         
         CreateResultIcon(displayName, 
                        historicalSignals[i].expirationTime, 
                        historicalSignals[i].isCall ? close[expBarIndex] - (10 * _Point) : close[expBarIndex] + (10 * _Point),
                        isCurrentlyWin,
                        historicalSignals[i].isCall);
         
         // Se fechou a vela, remover qualquer ícone temporário que possa existir
         if(expBarClosed) {
            string tempName = resultName + "_TEMP";
            if(ObjectFind(0, tempName) >= 0)
               ObjectDelete(0, tempName);
         }
      }
      
      // Atualizar totais e painel se necessário
      if (estatisticasAtualizadas) {
         totalSinais = totalWins + totalLosses;
         
         // Calcular assertividade
         if(totalSinais > 0)
            assertividade = (double)totalWins / totalSinais * 100.0;
         
         // Atualizar painel
         if(MostrarPainel)
            AtualizarPainel();
            
         Print("[Alma] Estatísticas atualizadas após expirações: W:" + IntegerToString(totalWins) + 
               " L:" + IntegerToString(totalLosses) + 
               " Total:" + IntegerToString(totalSinais) + 
               " Assert:" + DoubleToString(assertividade, 2) + "%");
      }
   }

   //+------------------------------------------------------------------+
   //| NOVA FUNÇÃO: Processar sinais para entrada na próxima vela       |
   //+------------------------------------------------------------------+
   void ProcessarSinalProximaVela(int barIndex, bool isCall, bool isPut, const datetime &time[], 
                                 const double &open[], const double &high[], const double &low[], 
                                 const double &close[])
   {
      // Se não temos próxima vela para processar, sair
      if(barIndex <= 0) return;
      
      int nextBarIndex = barIndex - 1;
      datetime nextBarTime = time[nextBarIndex];
      bool isClosed = time[nextBarIndex] < TimeCurrent() - PeriodSeconds();
      
      // CORREÇÃO: Sempre processar a vela atual quando VelasAtuais=true
      if(nextBarIndex == 0 && VelasAtuais)
      {
         // A próxima vela é a atual, então sempre processar se VelasAtuais=true
         // Não faz nada aqui, apenas pula a verificação abaixo
      }
      else if(!DeveProcessarVela(nextBarIndex, isClosed))
      {
         return;
      }
      
      // Verificar se já existe sinal ou pré-alerta na próxima vela
      if(ExistsHistoricalSignal(nextBarTime) || ExistsPreAlert(nextBarTime))
         return;
      
      // Se estamos usando pré-alertas, gerar pré-alerta na próxima vela
      if(UsePreAlertas)
      {
         bool permitirPreAlerta = DevePermitirPreAlerta(nextBarTime, time);
         
         if(permitirPreAlerta)
         {
            if(isCall)
            {
               double pricePreCall = low[nextBarIndex] - (5 * _Point);
               PreCallBuffer[nextBarIndex] = pricePreCall;
               
               AddPreAlert(nextBarTime, pricePreCall, true);
               ultimoTempoPreAlerta = nextBarTime;
               
               Print("[Alma] *** PRÉ-ALERTA CALL na PRÓXIMA VELA gerado em " + TimeToString(nextBarTime) + " ***");
            }
            else if(isPut)
            {
               double pricePrePut = high[nextBarIndex] + (5 * _Point);
               PrePutBuffer[nextBarIndex] = pricePrePut;
               
               AddPreAlert(nextBarTime, pricePrePut, false);
               ultimoTempoPreAlerta = nextBarTime;
               
               Print("[Alma] *** PRÉ-ALERTA PUT na PRÓXIMA VELA gerado em " + TimeToString(nextBarTime) + " ***");
            }
         }
      }
      else
      {
         // Gerar sinal diretamente na próxima vela
         bool permitirSinal = DevePermitirSinal(nextBarTime, time);
         bool isClosed = time[nextBarIndex] < TimeCurrent() - PeriodSeconds();
         
         if(permitirSinal)
         {
            if(isCall)
            {
               double priceCall = low[nextBarIndex] - (5 * _Point);
               
               ultimoTempoSinal = nextBarTime;
               
               Print("[Alma] *** SINAL CALL na PRÓXIMA VELA gerado em " + TimeToString(nextBarTime) + 
                     (isClosed ? " (backtest)" : "") + " ***");
                  
               AddHistoricalSignal(nextBarTime, priceCall, true, open[nextBarIndex], close[nextBarIndex], isClosed);
               CreateWinLossIcon("WinLoss_Call_" + IntegerToString(nextBarIndex), 
                              nextBarTime, 
                              priceCall, 
                              isClosed ? close[nextBarIndex] > open[nextBarIndex] : close[nextBarIndex] > open[nextBarIndex]);
            }
            else if(isPut)
            {
               double pricePut = high[nextBarIndex] + (5 * _Point);
               
               ultimoTempoSinal = nextBarTime;
               
               Print("[Alma] *** SINAL PUT na PRÓXIMA VELA gerado em " + TimeToString(nextBarTime) + 
                     (isClosed ? " (backtest)" : "") + " ***");
                  
               AddHistoricalSignal(nextBarTime, pricePut, false, open[nextBarIndex], close[nextBarIndex], isClosed);
               CreateWinLossIcon("WinLoss_Put_" + IntegerToString(nextBarIndex), 
                              nextBarTime, 
                              pricePut, 
                              isClosed ? close[nextBarIndex] < open[nextBarIndex] : close[nextBarIndex] < open[nextBarIndex]);
            }
         }
      }
   }

   //+------------------------------------------------------------------+
   //| NOVA FUNÇÃO: Mostra imediatamente o sinal de entrada              |
   //+------------------------------------------------------------------+
   void MostrarSinalEntrada(SignalInfo &signal)
   {
      // Criar apenas o ícone de sinal na vela de entrada
      string signalName = (signal.isCall ? "WinLoss_Call_" : "WinLoss_Put_") + 
                        TimeToString(signal.time) + "_Signal";
      
      CreateSignalIcon(signalName,
                     signal.time,
                     signal.price,
                     signal.isCall);
      
      Print("[Alma] Sinal de entrada mostrado imediatamente em " + TimeToString(signal.time));
   }

   //+------------------------------------------------------------------+
   //| Função para calcular estatísticas de backtest                     |
   //+------------------------------------------------------------------+
   void CalcularEstatisticas()
   {
      // CORREÇÃO: Resetar contadores antes de recalcular
      totalWins = 0;
      totalLosses = 0;
      
      // Contar wins e losses diretamente dos sinais processados
      for(int i = 0; i < ArraySize(historicalSignals); i++)
      {
         if(historicalSignals[i].isClosed || historicalSignals[i].expProcessed)
         {
            if(historicalSignals[i].isWin)
               totalWins++;
            else
               totalLosses++;
         }
      }
      
      totalSinais = totalWins + totalLosses;
      
      // Calcular assertividade
      if(totalSinais > 0)
         assertividade = (double)totalWins / totalSinais * 100.0;
      else
         assertividade = 0.0;
      
      // Chamar função específica para calcular o HIT
      AtualizarMaxLossesConsecutivos();
      
      Print("[Alma] Estatísticas calculadas: " + IntegerToString(totalSinais) + " sinais (W:" + 
            IntegerToString(totalWins) + "/L:" + IntegerToString(totalLosses) + 
            "), Assertividade: " + DoubleToString(assertividade, 2) + "%, HIT: " + 
            IntegerToString(maxLossesConsecutivos));
   }

   //+------------------------------------------------------------------+
   //| Função para criar o painel de backtest                            |
   //+------------------------------------------------------------------+
   void CriarPainel()
   {
      if(!MostrarPainel)
         return;
         
      // Remover painel existente e todos os objetos relacionados
      ObjectsDeleteAll(0, nomePainel);
      ObjectsDeleteAll(0, "AlmaPainel");
      
      // Definir dimensões do painel
      int largura = 200;  // Largura base do painel
      int altura = 100;   // Altura aumentada para incluir estatística de Gale 1
      int espacamentoY = 20; // Espaçamento entre linhas
      
      // Criar novo painel como objeto retangular
      if(!ObjectCreate(0, nomePainel, OBJ_RECTANGLE_LABEL, 0, 0, 0))
      {
         Print("[Alma ERRO] Falha ao criar painel de backtest. Erro: " + IntegerToString(GetLastError()));
         return;
      }
      
      // Configurar propriedades do painel principal
      ObjectSetInteger(0, nomePainel, OBJPROP_XDISTANCE, PainelX);
      ObjectSetInteger(0, nomePainel, OBJPROP_YDISTANCE, PainelY);
      ObjectSetInteger(0, nomePainel, OBJPROP_XSIZE, largura);
      ObjectSetInteger(0, nomePainel, OBJPROP_YSIZE, altura);
      ObjectSetInteger(0, nomePainel, OBJPROP_BGCOLOR, clrBlack);
      ObjectSetInteger(0, nomePainel, OBJPROP_BORDER_TYPE, 0);
      ObjectSetInteger(0, nomePainel, OBJPROP_COLOR, CorBordaPainel);
      ObjectSetInteger(0, nomePainel, OBJPROP_WIDTH, 1);
      ObjectSetInteger(0, nomePainel, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, nomePainel, OBJPROP_STYLE, STYLE_SOLID);
      ObjectSetInteger(0, nomePainel, OBJPROP_BACK, false);
      ObjectSetInteger(0, nomePainel, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, nomePainel, OBJPROP_HIDDEN, true);
      ObjectSetInteger(0, nomePainel, OBJPROP_ZORDER, 100);
      
      // Criar título centralizado
      CriarTextoPainel("AlmaPainelTitulo", "Alma Binary", PainelX + (largura/2), PainelY + 15, clrWhite, 12, "Arial Bold", true);

      // Linha separadora após o título
      string sepName = "AlmaPainelSeparador";
      ObjectCreate(0, sepName, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(0, sepName, OBJPROP_XDISTANCE, PainelX);
      ObjectSetInteger(0, sepName, OBJPROP_YDISTANCE, PainelY + 30);
      ObjectSetInteger(0, sepName, OBJPROP_XSIZE, largura);
      ObjectSetInteger(0, sepName, OBJPROP_YSIZE, 1);
      ObjectSetInteger(0, sepName, OBJPROP_BGCOLOR, clrWhite);
      ObjectSetInteger(0, sepName, OBJPROP_COLOR, clrWhite);

      // MÃO FIXA - linha com informações 
      int yPos = PainelY + 45; // Posição Y inicial após o título e separador
      
      // Labels da MÃO FIXA com posicionamento ajustado conforme a imagem
      CriarTextoPainel("AlmaPainelMaoFixaLabel", "MÃO FIXA:", PainelX + 10, yPos, clrWhite, 10, "Arial");
      
      // Posições ajustadas para combinar com a imagem modelo
      // Os valores serão preenchidos na função AtualizarPainel()
      CriarTextoPainel("AlmaPainelMaoFixaWinLoss", "", PainelX + 85, yPos, CorWin, 10, "Arial Bold");
      CriarTextoPainel("AlmaPainelMaoFixaAssert", "", PainelX + 125, yPos, CorWin, 10, "Arial Bold");
      CriarTextoPainel("AlmaPainelMaoFixaHitLabel", "HIT:", PainelX + 155, yPos, clrAqua, 10, "Arial");
      CriarTextoPainel("AlmaPainelMaoFixaHitValor", "", PainelX + 180, yPos, CorLoss, 10, "Arial Bold");
      
      // GALE 1 - nova linha com informações (abaixo da MÃO FIXA)
      yPos = PainelY + 65; // 20 pixels abaixo da linha anterior
      
      // Labels do GALE 1
      CriarTextoPainel("AlmaPainelGale1Label", "GALE 1:", PainelX + 10, yPos, clrWhite, 10, "Arial");
      CriarTextoPainel("AlmaPainelGale1WinLoss", "", PainelX + 85, yPos, CorWin, 10, "Arial Bold");
      CriarTextoPainel("AlmaPainelGale1Assert", "", PainelX + 125, yPos, CorWin, 10, "Arial Bold");
      CriarTextoPainel("AlmaPainelGale1HitLabel", "HIT:", PainelX + 155, yPos, clrAqua, 10, "Arial");
      CriarTextoPainel("AlmaPainelGale1HitValor", "", PainelX + 180, yPos, CorLoss, 10, "Arial Bold");
      
      // Linha de entradas no rodapé
      CriarTextoPainel("AlmaPainelEntradas", "ENTRADAS: 0", PainelX + (largura/2), PainelY + altura - 15, clrWhite, 10, "Arial", true);
      
      // Atualizar com os dados atuais
      AtualizarPainel();
   }

   //+------------------------------------------------------------------+
   //| Função para criar texto no painel                                 |
   //+------------------------------------------------------------------+
   void CriarTextoPainel(string nome, string texto, int x, int y, color cor, int tamanho, string fonte="Arial", bool centralizado=false, bool negrito=false)
   {
      ObjectDelete(0, nome);
      
      if(!ObjectCreate(0, nome, OBJ_LABEL, 0, 0, 0))
      {
         Print("[Alma ERRO] Falha ao criar texto do painel. Erro: " + IntegerToString(GetLastError()));
         return;
      }
      
      ObjectSetInteger(0, nome, OBJPROP_XDISTANCE, x);
      ObjectSetInteger(0, nome, OBJPROP_YDISTANCE, y);
      ObjectSetInteger(0, nome, OBJPROP_COLOR, cor);
      ObjectSetInteger(0, nome, OBJPROP_FONTSIZE, tamanho);
      ObjectSetInteger(0, nome, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      
      // Aplicar fonte em negrito se solicitado
      if(negrito)
         ObjectSetString(0, nome, OBJPROP_FONT, fonte + " Bold");
      else
         ObjectSetString(0, nome, OBJPROP_FONT, fonte);
         
      ObjectSetString(0, nome, OBJPROP_TEXT, texto);
      ObjectSetInteger(0, nome, OBJPROP_ANCHOR, centralizado ? ANCHOR_CENTER : ANCHOR_LEFT);
      ObjectSetInteger(0, nome, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, nome, OBJPROP_HIDDEN, true);
      ObjectSetInteger(0, nome, OBJPROP_ZORDER, 102);
   }

   //+------------------------------------------------------------------+
   //| Função para atualizar o painel com estatísticas atuais            |
   //+------------------------------------------------------------------+
   void AtualizarPainel()
   {
      if(!MostrarPainel)
         return;
      
      // CORREÇÃO: Não recalcular aqui, usar valores já calculados
      // CalcularEstatisticas();
      
      // Determinar cor com base na assertividade (verde para 50%+ e vermelho para menos de 50%)
      color statsColor = assertividade >= 50.0 ? clrLime : clrRed;
      color statsGale1Color = assertividadeGale1 >= 50.0 ? clrLime : clrRed;
      
      // Formatar o texto no estilo da imagem: "10x5" "50%" "HIT: 2" 
      string resultWinLoss = IntegerToString(totalWins) + "x" + IntegerToString(totalLosses);
      string resultAssert = IntegerToString((int)assertividade) + "%";
      
      // Formatar texto para GALE 1
      string resultGale1WinLoss = IntegerToString(winGale1) + "x" + IntegerToString(lossGale1);
      string resultGale1Assert = IntegerToString((int)assertividadeGale1) + "%";
      
      // CORREÇÃO: Calcular o total real de entradas 
      // winGale1 já contém totalWins + winsGale1Adicionais
      int totalEntradasComGale = winGale1 + lossGale1; // Total correto: mãos fixas + todas operações de Gale
      
      // Debug para confirmar valores sendo exibidos
      Print("[Alma] Atualizando painel: MÃO FIXA=" + resultWinLoss + " " + resultAssert + " HIT:" + IntegerToString(maxLossesConsecutivos) + 
            ", GALE 1=" + resultGale1WinLoss + " " + resultGale1Assert + " HIT:" + IntegerToString(maxLossGale1) +
            ", Total entradas com Gale: " + IntegerToString(totalEntradasComGale));
      
      // Atualizar textos da linha MÃO FIXA
      ObjectSetString(0, "AlmaPainelMaoFixaWinLoss", OBJPROP_TEXT, resultWinLoss);
      ObjectSetString(0, "AlmaPainelMaoFixaAssert", OBJPROP_TEXT, resultAssert);
      ObjectSetString(0, "AlmaPainelMaoFixaHitValor", OBJPROP_TEXT, IntegerToString(maxLossesConsecutivos));
      
      // Atualizar textos da linha GALE 1
      ObjectSetString(0, "AlmaPainelGale1WinLoss", OBJPROP_TEXT, resultGale1WinLoss);
      ObjectSetString(0, "AlmaPainelGale1Assert", OBJPROP_TEXT, resultGale1Assert);
      ObjectSetString(0, "AlmaPainelGale1HitValor", OBJPROP_TEXT, IntegerToString(maxLossGale1));
      
      // Atualizar cor conforme assertividade (win/loss)
      ObjectSetInteger(0, "AlmaPainelMaoFixaWinLoss", OBJPROP_COLOR, statsColor);
      ObjectSetInteger(0, "AlmaPainelMaoFixaAssert", OBJPROP_COLOR, statsColor);
      
      // Atualizar cor conforme assertividade do GALE 1
      ObjectSetInteger(0, "AlmaPainelGale1WinLoss", OBJPROP_COLOR, statsGale1Color);
      ObjectSetInteger(0, "AlmaPainelGale1Assert", OBJPROP_COLOR, statsGale1Color);
      
      // CORREÇÃO: Atualizar rodapé com total real de entradas incluindo Gale 1
      ObjectSetString(0, "AlmaPainelEntradas", OBJPROP_TEXT, "ENTRADAS: " + IntegerToString(totalEntradasComGale));
      
      ChartRedraw();
   }

   //+------------------------------------------------------------------+
   //| NOVA FUNÇÃO: Atualizar HIT (máximo de losses consecutivos)       |
   //+------------------------------------------------------------------+
   void AtualizarMaxLossesConsecutivos()
   {
      // Sempre resetar a variável local para garantir cálculo correto
      int sequenciaAtualLoss = 0;
      int maxSequenciaAtual = 0;
      
      // Variáveis para estatísticas de GALE 1
      int sequenciaAtualGale1 = 0;
      int maxSequenciaGale1 = 0;
      
      // Se não há sinais fechados, não há o que processar
      if(totalSinais == 0)
      {
         maxLossesConsecutivos = 0;
         lossesConsecutivos = 0;
         winGale1 = 0;
         lossGale1 = 0;
         maxLossGale1 = 0;
         assertividadeGale1 = 0.0;
         return;
      }
      
      // Primeiro, criar uma array temporária com todos os sinais fechados
      SignalInfo sinaisFechados[];
      int contSinaisFechados = 0;
      
      // Contar quantos sinais fechados temos
      for(int i = 0; i < ArraySize(historicalSignals); i++)
      {
         if(historicalSignals[i].isClosed || historicalSignals[i].expProcessed)
            contSinaisFechados++;
      }
      
      // Se não há sinais fechados, não há o que processar
      if(contSinaisFechados == 0)
      {
         maxLossesConsecutivos = 0;
         lossesConsecutivos = 0;
         winGale1 = 0;
         lossGale1 = 0;
         maxLossGale1 = 0;
         assertividadeGale1 = 0.0;
         return;
      }
      
      // Redimensionar o array e copiar os sinais fechados
      ArrayResize(sinaisFechados, contSinaisFechados);
      int idx = 0;
      for(int i = 0; i < ArraySize(historicalSignals); i++)
      {
         if(historicalSignals[i].isClosed || historicalSignals[i].expProcessed)
         {
            sinaisFechados[idx] = historicalSignals[i];
            idx++;
         }
      }
      
      // CORREÇÃO: Usar algoritmo mais simples para ordenação
      datetime tempoDosResultados[];
      bool resultadoDosResultados[];
      
      // Criar arrays para tempo e resultado (win/loss)
      ArrayResize(tempoDosResultados, contSinaisFechados);
      ArrayResize(resultadoDosResultados, contSinaisFechados);
      
      // Extrair tempos e resultados
      for(int i = 0; i < contSinaisFechados; i++)
      {
         tempoDosResultados[i] = sinaisFechados[i].time;
         resultadoDosResultados[i] = sinaisFechados[i].isWin;
      }
      
      // Ordenar os resultados pelo tempo usando arrays duplicados
      for(int i = 0; i < contSinaisFechados - 1; i++)
      {
         int minIndex = i;
         for(int j = i + 1; j < contSinaisFechados; j++)
         {
            if(tempoDosResultados[j] < tempoDosResultados[minIndex])
               minIndex = j;
         }
         
         // Trocar os valores se necessário
         if(minIndex != i)
         {
            // Trocar tempos
            datetime tempTime = tempoDosResultados[i];
            tempoDosResultados[i] = tempoDosResultados[minIndex];
            tempoDosResultados[minIndex] = tempTime;
            
            // Trocar resultados
            bool tempResult = resultadoDosResultados[i];
            resultadoDosResultados[i] = resultadoDosResultados[minIndex];
            resultadoDosResultados[minIndex] = tempResult;
         }
      }
      
      // Resetar contadores para cálculos
      int winsGale1Adicionais = 0; // Nova variável para contar wins adicionais pelo Gale 1
      lossGale1 = 0;
      sequenciaAtualLoss = 0;
      maxSequenciaAtual = 0;
      sequenciaAtualGale1 = 0;
      maxSequenciaGale1 = 0;
      bool estaEmGale = false;
      
      // Logs para debug
      string resultadosOrdenados = "[DEBUG] Resultados ordenados: ";
      string resultadosGale = "[DEBUG] Análise Gale: ";
      
      // Loop para calcular MÃO FIXA e GALE 1
      for(int i = 0; i < contSinaisFechados; i++)
      {
         // Adicionar ao log de resultados
         resultadosOrdenados += (resultadoDosResultados[i] ? "W" : "L") + " ";
         
         // Análise para MÃO FIXA (losses consecutivos)
         if(!resultadoDosResultados[i]) // Se for loss
         {
            sequenciaAtualLoss++;
            
            // Atualizar o máximo da execução atual
            if(sequenciaAtualLoss > maxSequenciaAtual)
               maxSequenciaAtual = sequenciaAtualLoss;
               
            if(!estaEmGale) 
            {
               // Se não estamos em Gale, este loss ativa o Gale1
               estaEmGale = true;
               resultadosGale += "[L→G1] ";
            }
            else
            {
               // Se já estávamos em Gale, este é um loss no Gale 1
               lossGale1++;
               sequenciaAtualGale1++;
               
               // Verificar se a sequência atual de Gale 1 supera o máximo
               if(sequenciaAtualGale1 > maxSequenciaGale1)
                  maxSequenciaGale1 = sequenciaAtualGale1;
                  
               // Saímos do estado de Gale após o loss
               estaEmGale = false;
               resultadosGale += "[G1→L] ";
            }
         }
         else // Se for win
         {
            // Resetar a sequência de losses consecutivos
            sequenciaAtualLoss = 0;
            
            if(estaEmGale)
            {
               // Win após um loss = Gale 1 bem-sucedido
               winsGale1Adicionais++; // Contabilizamos como win adicional do Gale 1
               estaEmGale = false; // Saímos do Gale após um win
               resultadosGale += "[G1→W] ";
            }
            else
            {
               // Win normal, não estamos em Gale
               resultadosGale += "[W] ";
            }
            
            // Sempre resetar a sequência de Gale após um win
            sequenciaAtualGale1 = 0;
         }
      }
      
      // MODIFICAÇÃO: O total de wins do Gale 1 agora é a soma dos wins da mão fixa + wins adicionais do Gale 1
      winGale1 = totalWins + winsGale1Adicionais;
      
      // Calcular a assertividade do Gale 1 - agora considerando o total de operações (mão fixa + gales)
      int totalGale1 = winGale1 + lossGale1;
      if(totalGale1 > 0)
         assertividadeGale1 = (double)winGale1 / totalGale1 * 100.0;
      else
         assertividadeGale1 = 0.0;
         
      // Atualizar o máximo histórico de losses consecutivos (mão fixa)
      maxLossesConsecutivos = maxSequenciaAtual;
      
      // Atualizar o contador atual de losses (mão fixa)
      lossesConsecutivos = sequenciaAtualLoss;
      
      // Atualizar o máximo histórico de losses consecutivos no Gale 1
      maxLossGale1 = maxSequenciaGale1;
      
      Print(resultadosOrdenados); // Log para debug
      Print(resultadosGale); // Log para análise de Gale 1
      
      Print("[Alma] HIT normal: " + IntegerToString(maxLossesConsecutivos) + 
            " losses consecutivos, HIT Gale1: " + IntegerToString(maxLossGale1) +
            " losses consecutivos");
      
      // Modificado o log para incluir informação sobre wins adicionais de Gale 1
      Print("[Alma] Estatísticas Gale1: Wins totais=" + IntegerToString(winGale1) + 
            " (Mão fixa: " + IntegerToString(totalWins) + ", Adicionais Gale1: " + 
            IntegerToString(winsGale1Adicionais) + ")" +
            ", Losses=" + IntegerToString(lossGale1) + 
            ", Total=" + IntegerToString(totalGale1) + 
            ", Assert=" + DoubleToString(assertividadeGale1, 2) + "%");
   }

   //+------------------------------------------------------------------+
   //| NOVA FUNÇÃO: Resetar estatísticas e limpar sinais históricos     |
   //+------------------------------------------------------------------+
   void ResetarEstatisticas()
   {
      // Resetar contadores
      totalSinais = 0;
      totalWins = 0;
      totalLosses = 0;
      assertividade = 0.0;
      lossesConsecutivos = 0;
      maxLossesConsecutivos = 0;
      
      // Resetar contadores de Gale 1
      winGale1 = 0;
      lossGale1 = 0;
      maxLossGale1 = 0;
      assertividadeGale1 = 0.0;
      
      Print("[Alma] Estatísticas de backtest ZERADAS - Novo modo apenas velas atuais/futuras");
      
      // Limpar todos os sinais históricos (velas passadas)
      datetime tempoAtual = TimeCurrent();
      int periodoAtual = PeriodSeconds();
      
      // Remover objetos visuais das velas passadas
      ObjectsDeleteAll(0, "WinLoss_Call_");
      ObjectsDeleteAll(0, "WinLoss_Put_");
      
      // Remover sinais históricos do array, mantendo apenas os da vela atual/futura
      int j = 0;
      SignalInfo sinaisAtuais[];
      ArrayResize(sinaisAtuais, 0);
      
      // Primeiro passo: identificar quais sinais devem ser mantidos (vela atual e futuras)
      for(int i = 0; i < ArraySize(historicalSignals); i++)
      {
         // CORREÇÃO: Manter apenas sinais da vela atual e futuras
         // Se o sinal é da vela atual ou futura, manter
         if(historicalSignals[i].time >= tempoAtual - periodoAtual)
         {
            ArrayResize(sinaisAtuais, j+1);
            sinaisAtuais[j] = historicalSignals[i];
            j++;
            
            // CORREÇÃO: Não contabilizar sinais da vela atual nas estatísticas iniciais
            // Eles serão contabilizados quando fecharem
            if(sinaisAtuais[j-1].isClosed || sinaisAtuais[j-1].expProcessed)
            {
               if(sinaisAtuais[j-1].isWin)
                  totalWins++;
               else
                  totalLosses++;
               
               Print("[Alma] Mantido sinal fechado " + (sinaisAtuais[j-1].isCall ? "CALL" : "PUT") + 
                  " em " + TimeToString(sinaisAtuais[j-1].time) + 
                  (sinaisAtuais[j-1].isWin ? " WIN" : " LOSS"));
            }
            else
            {
               Print("[Alma] Mantido sinal aberto " + (sinaisAtuais[j-1].isCall ? "CALL" : "PUT") + 
                  " em " + TimeToString(sinaisAtuais[j-1].time));
            }
         }
      }
      
      // Atualizar o total de sinais
      totalSinais = totalWins + totalLosses;
      
      // Calcular assertividade
      if(totalSinais > 0)
         assertividade = (double)totalWins / totalSinais * 100.0;
      else
         assertividade = 0.0;
      
      // Substituir o array original pelo novo array filtrado
      ArrayResize(historicalSignals, ArraySize(sinaisAtuais));
      for(int i = 0; i < ArraySize(sinaisAtuais); i++)
         historicalSignals[i] = sinaisAtuais[i];
      
      Print("[Alma] Mantidos " + IntegerToString(ArraySize(historicalSignals)) + " sinais da vela atual/futuras");
      Print("[Alma] Estatísticas atuais: " + IntegerToString(totalSinais) + " sinais (W:" + 
            IntegerToString(totalWins) + "/L:" + IntegerToString(totalLosses) + 
            "), Assertividade: " + DoubleToString(assertividade, 2) + "%");
      
      // Limpar também pré-alertas antigos
      j = 0;
      PreAlertInfo preAlertasAtuais[];
      ArrayResize(preAlertasAtuais, 0);
      
      for(int i = 0; i < ArraySize(preAlerts); i++)
      {
         // Se o pré-alerta é da vela atual ou futura, manter
         if(preAlerts[i].time >= tempoAtual - periodoAtual)
         {
            ArrayResize(preAlertasAtuais, j+1);
            preAlertasAtuais[j] = preAlerts[i];
            j++;
         }
      }
      
      // Substituir o array original pelo novo array filtrado
      ArrayResize(preAlerts, ArraySize(preAlertasAtuais));
      for(int i = 0; i < ArraySize(preAlertasAtuais); i++)
         preAlerts[i] = preAlertasAtuais[i];
      
      Print("[Alma] Mantidos " + IntegerToString(ArraySize(preAlerts)) + " pré-alertas da vela atual/futuras");
      
      // Recriar os objetos visuais para os sinais mantidos
      for(int i = 0; i < ArraySize(historicalSignals); i++)
      {
         // Recriar o objeto visual para cada sinal mantido
         if(historicalSignals[i].isCall)
         {
            CreateWinLossIcon("WinLoss_Call_" + TimeToString(historicalSignals[i].time), 
                           historicalSignals[i].time, 
                           historicalSignals[i].price, 
                           historicalSignals[i].isClosed ? historicalSignals[i].isWin : 
                           (historicalSignals[i].closePrice > historicalSignals[i].openPrice));
         }
         else
         {
            CreateWinLossIcon("WinLoss_Put_" + TimeToString(historicalSignals[i].time), 
                           historicalSignals[i].time, 
                           historicalSignals[i].price, 
                           historicalSignals[i].isClosed ? historicalSignals[i].isWin : 
                           (historicalSignals[i].closePrice < historicalSignals[i].openPrice));
         }
      }
      
      // Atualizar o painel com as estatísticas atualizadas
      if(MostrarPainel)
      {
         Print("[Alma] Atualizando painel com estatísticas da vela atual/futuras");
         AtualizarPainel();
      }
      
      ChartRedraw();
   }

   //+------------------------------------------------------------------+
   //| Função de desinicialização do indicador customizado               |
   //+------------------------------------------------------------------+
   void OnDeinit(const int reason)
   {
      ObjectsDeleteAll(0, "WinLoss_Call_");
      ObjectsDeleteAll(0, "WinLoss_Put_");
      ObjectsDeleteAll(0, "PreAlert_");
      ObjectsDeleteAll(0, "AlmaPainel");
      
      if(externalHandle1 != INVALID_HANDLE)
         IndicatorRelease(externalHandle1);
      if(externalHandle2 != INVALID_HANDLE)
         IndicatorRelease(externalHandle2);
         
      Print("[Alma] Indicador Alma descarregado - Motivo: " + IntegerToString(reason));
   }
