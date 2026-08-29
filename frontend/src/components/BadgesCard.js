import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { AuthContext } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Lock, Award } from 'lucide-react';
import { badgeIcon, badgeStyles } from '../lib/badges';

export const BadgesCard = ({ reloadKey }) => {
  const { API } = useContext(AuthContext);
  const [data, setData] = useState(null);

  useEffect(() => {
    axios.get(`${API}/badges`).then((r) => setData(r.data)).catch(() => setData(null));
  }, [API, reloadKey]);

  if (!data) return null;

  const pct = Math.round((data.earned_count / data.total) * 100);

  return (
    <Card className="bg-white/70 backdrop-blur-sm mb-8" data-testid="badges-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-6 h-6 text-amber-500" />
          <span>My Badges</span>
          <Badge className="bg-amber-100 text-amber-800" data-testid="badges-earned-count">
            {data.earned_count}/{data.total}
          </Badge>
        </CardTitle>
        <CardDescription>Collect badges by learning, creating and competing</CardDescription>
        <Progress value={pct} className="mt-2 h-2" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {data.badges.map((b) => {
            const Icon = badgeIcon(b.icon);
            return (
              <div
                key={b.key}
                title={`${b.name} — ${b.description}`}
                className={`flex flex-col items-center text-center p-3 rounded-xl border-2 transition-all duration-300 ${
                  b.earned
                    ? 'border-transparent bg-white shadow-md hover:-translate-y-1'
                    : 'border-dashed border-gray-300 bg-gray-50'
                }`}
                data-testid={`badge-${b.key}`}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                    b.earned
                      ? `bg-gradient-to-br ${badgeStyles[b.color] || badgeStyles.amber} shadow-lg`
                      : 'bg-gray-200'
                  }`}
                >
                  {b.earned
                    ? <Icon className="w-6 h-6 text-white" />
                    : <Lock className="w-5 h-5 text-gray-400" />}
                </div>
                <p className={`text-xs font-semibold leading-tight ${b.earned ? 'text-gray-900' : 'text-gray-500'}`}>
                  {b.name}
                </p>
                {b.earned ? (
                  <p className="text-[10px] text-emerald-600 mt-1" data-testid={`badge-earned-${b.key}`}>
                    {new Date(b.earned_at).toLocaleDateString()}
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-400 mt-1" data-testid={`badge-progress-${b.key}`}>
                    {b.progress}/{b.goal}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default BadgesCard;
