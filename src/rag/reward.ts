import { AgentDecision } from '../types/agent';
import { DebugSession } from '../types/session';

export interface RewardResult {
  reward: number;
  explanation: string[];
}

export class RewardCalculator {
  calculate(session: DebugSession, decision: AgentDecision): RewardResult {
    let reward = 0;
    const explanation: string[] = [];

    if (decision.nextAction === 'accept') {
      reward += 1.0;
      explanation.push('+1.0 accepted final decision');
    }

    if (decision.testResult?.passed) {
      reward += 0.5;
      explanation.push('+0.5 validation passed');
    }

    if (decision.critique?.approved) {
      reward += 0.2;
      explanation.push('+0.2 critic approved patch');
    }

    if (decision.nextAction === 'reject') {
      reward -= 0.5;
      explanation.push('-0.5 rejected after exhausting attempts');
    }

    const roundEfficiencyBonus = Math.max(0, session.maxRounds - session.currentRound) * 0.05;

    if (roundEfficiencyBonus > 0) {
      reward += roundEfficiencyBonus;
      explanation.push(`+${roundEfficiencyBonus.toFixed(2)} round efficiency bonus`);
    }

    return {
      reward: Number(reward.toFixed(3)),
      explanation,
    };
  }
}
