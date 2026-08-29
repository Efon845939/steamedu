import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import axios from 'axios';
import { SUBJECTS, AGE_GROUPS, subjectEmoji, difficultyColor } from '../lib/steam';
import { ArrowLeft, ExternalLink, BookOpen, FlaskConical, Calculator, ListChecks, Puzzle } from 'lucide-react';

const AREA_META = {
  Science: { color: 'from-blue-500 to-blue-600', text: 'text-blue-600', desc: 'Space, biology, chemistry and physics — explore how the universe works.' },
  Technology: { color: 'from-purple-500 to-purple-600', text: 'text-purple-600', desc: 'Computers, the internet, programming and AI.' },
  Engineering: { color: 'from-green-500 to-green-600', text: 'text-green-600', desc: 'Bridges, rockets and machines — design things that work.' },
  Arts: { color: 'from-pink-500 to-pink-600', text: 'text-pink-600', desc: 'Color theory, design, animation and creative composition.' },
  Mathematics: { color: 'from-orange-500 to-orange-600', text: 'text-orange-600', desc: 'Algebra, geometry, calculus and the patterns behind everything.' },
};

const ContentHub = () => {
  const navigate = useNavigate();
  const { user, API } = useContext(AuthContext);
  const [area, setArea] = useState(null);
  const [ageGroup, setAgeGroup] = useState(user?.age_group || 'all');
  const [content, setContent] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [activities, setActivities] = useState([]);
  const [allContent, setAllContent] = useState([]);
  const [detail, setDetail] = useState(null);
  const [showSolution, setShowSolution] = useState(false);

  useEffect(() => {
    axios.get(`${API}/content`).then((r) => setAllContent(r.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!area) return;
    const params = { subject: area };
    if (ageGroup !== 'all') params.age_group = ageGroup;
    Promise.all([
      axios.get(`${API}/content`, { params }),
      axios.get(`${API}/quizzes`, { params }),
      axios.get(`${API}/activities`, { params }),
    ]).then(([c, q, a]) => {
      setContent(c.data);
      setQuizzes(q.data);
      setActivities(a.data);
    }).catch(console.error);
  }, [area, ageGroup]);

  const openDetail = (item) => {
    setDetail(item);
    setShowSolution(false);
  };

  const ContentCard = ({ item }) => (
    <Card className="bg-white/70 backdrop-blur-sm hover:shadow-xl transition-all duration-300 card-hover flex flex-col" data-testid={`content-card-${item.id}`}>
      <CardHeader className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <Badge className={difficultyColor(item.difficulty)}>{item.difficulty}</Badge>
          <div className="flex gap-1">
            {(item.age_groups || []).map((g) => (
              <Badge key={g} variant="outline" className="text-xs">{g === 'all' ? 'All ages' : g}</Badge>
            ))}
          </div>
        </div>
        <CardTitle className="text-lg text-gray-900">{item.title}</CardTitle>
        <CardDescription className="text-gray-600 text-sm">{item.summary}</CardDescription>
        <div className="text-xs text-gray-500 pt-1">
          {item.read_time && <span>📖 {item.read_time}</span>}
          {item.duration && <span>⏱️ {item.duration}</span>}
          {item.topic && <span>📐 {item.topic}</span>}
        </div>
      </CardHeader>
      <CardContent>
        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700"
          onClick={() => openDetail(item)}
          data-testid={`open-content-${item.id}`}
        >
          {item.type === 'article' ? 'Read Article' : item.type === 'experiment' ? 'View Experiment' : 'Solve Problem'}
        </Button>
      </CardContent>
    </Card>
  );

  const grid = (items) => (
    items.length === 0
      ? <p className="text-center text-gray-500 py-12">Nothing here for this age group yet — try "All ages".</p>
      : <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{items.map((i) => <ContentCard key={i.id} item={i} />)}</div>
  );

  // -------- Area landing --------
  if (!area) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">STEAM Content Hub 📚</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Pick a STEAM area to find real articles, hands-on experiments, problems, quizzes and activities — matched to your age group.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SUBJECTS.map((s) => {
              const counts = allContent.filter((c) => c.subject === s);
              return (
                <Card
                  key={s}
                  className="bg-white/70 backdrop-blur-sm hover:shadow-xl transition-all duration-300 cursor-pointer group border-2 border-transparent hover:border-emerald-200"
                  onClick={() => setArea(s)}
                  data-testid={`area-card-${s.toLowerCase()}`}
                >
                  <CardHeader>
                    <div className={`w-16 h-16 bg-gradient-to-br ${AREA_META[s].color} rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <span className="text-3xl">{subjectEmoji(s)}</span>
                    </div>
                    <CardTitle className={`text-2xl ${AREA_META[s].text}`}>{s}</CardTitle>
                    <CardDescription className="text-gray-600">{AREA_META[s].desc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      <Badge variant="outline">{counts.filter((c) => c.type === 'article').length} articles</Badge>
                      <Badge variant="outline">{counts.filter((c) => c.type === 'experiment').length} experiments</Badge>
                      <Badge variant="outline">{counts.filter((c) => c.type === 'problem').length} problems</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // -------- Area view --------
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Button variant="ghost" onClick={() => setArea(null)} className="mb-4 text-gray-600" data-testid="back-to-areas-btn">
          <ArrowLeft className="w-4 h-4 mr-2" /> All areas
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 bg-gradient-to-br ${AREA_META[area].color} rounded-full flex items-center justify-center`}>
              <span className="text-2xl">{subjectEmoji(area)}</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{area}</h1>
              <p className="text-gray-600">{AREA_META[area].desc}</p>
            </div>
          </div>
          <div className="mt-4 sm:mt-0">
            <Select value={ageGroup} onValueChange={setAgeGroup}>
              <SelectTrigger className="w-44" data-testid="content-age-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ages</SelectItem>
                {AGE_GROUPS.map((g) => <SelectItem key={g} value={g}>Ages {g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="articles" className="w-full">
          <TabsList className="grid w-full max-w-3xl mx-auto grid-cols-5 mb-8">
            <TabsTrigger value="articles" data-testid="articles-tab"><BookOpen className="w-4 h-4 mr-1 hidden sm:block" />Articles</TabsTrigger>
            <TabsTrigger value="experiments" data-testid="experiments-tab"><FlaskConical className="w-4 h-4 mr-1 hidden sm:block" />Experiments</TabsTrigger>
            <TabsTrigger value="problems" data-testid="problems-tab"><Calculator className="w-4 h-4 mr-1 hidden sm:block" />Problems</TabsTrigger>
            <TabsTrigger value="quizzes" data-testid="quizzes-tab"><ListChecks className="w-4 h-4 mr-1 hidden sm:block" />Quizzes</TabsTrigger>
            <TabsTrigger value="activities" data-testid="activities-tab"><Puzzle className="w-4 h-4 mr-1 hidden sm:block" />Activities</TabsTrigger>
          </TabsList>

          <TabsContent value="articles">{grid(content.filter((c) => c.type === 'article'))}</TabsContent>
          <TabsContent value="experiments">{grid(content.filter((c) => c.type === 'experiment'))}</TabsContent>
          <TabsContent value="problems">{grid(content.filter((c) => c.type === 'problem'))}</TabsContent>

          <TabsContent value="quizzes">
            {quizzes.length === 0 ? (
              <p className="text-center text-gray-500 py-12">No quizzes for this filter yet.</p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {quizzes.map((quiz) => (
                  <Card key={quiz.id} className="bg-white/70 backdrop-blur-sm hover:shadow-xl transition-all duration-300 card-hover">
                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-xs">{quiz.questions.length} Questions</Badge>
                        <div className="flex gap-1">
                          {(quiz.age_groups || []).map((g) => <Badge key={g} variant="outline" className="text-xs">{g === 'all' ? 'All ages' : g}</Badge>)}
                        </div>
                      </div>
                      <CardTitle className="text-lg text-gray-900">{quiz.title}</CardTitle>
                      <CardDescription>{quiz.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        onClick={() => navigate(user ? `/quiz/${quiz.id}` : '/auth')}
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        data-testid={`content-start-quiz-${quiz.id}`}
                      >
                        {user ? 'Start Quiz' : 'Login to Start'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="activities">
            {activities.length === 0 ? (
              <p className="text-center text-gray-500 py-12">No activities for this filter yet.</p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activities.map((activity) => (
                  <Card key={activity.id} className="bg-white/70 backdrop-blur-sm hover:shadow-xl transition-all duration-300 card-hover">
                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <Badge className={difficultyColor(activity.difficulty)}>{activity.difficulty}</Badge>
                        <div className="flex gap-1">
                          {(activity.age_groups || []).map((g) => <Badge key={g} variant="outline" className="text-xs">{g === 'all' ? 'All ages' : g}</Badge>)}
                        </div>
                      </div>
                      <CardTitle className="text-lg text-gray-900">{activity.title}</CardTitle>
                      <CardDescription>{activity.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        onClick={() => navigate(user ? `/activities?start=${activity.id}` : '/auth')}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                        data-testid={`content-start-activity-${activity.id}`}
                      >
                        {user ? 'Start Activity' : 'Login to Start'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Detail dialog */}
        <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
          <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto" data-testid="content-detail-dialog">
            {detail && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={difficultyColor(detail.difficulty)}>{detail.difficulty}</Badge>
                    <Badge variant="outline">{subjectEmoji(detail.subject)} {detail.subject}</Badge>
                    {detail.read_time && <Badge variant="outline">📖 {detail.read_time}</Badge>}
                    {detail.duration && <Badge variant="outline">⏱️ {detail.duration}</Badge>}
                  </div>
                  <DialogTitle className="text-2xl">{detail.title}</DialogTitle>
                  <DialogDescription className="text-base">{detail.summary}</DialogDescription>
                </DialogHeader>

                {detail.materials && (
                  <div className="bg-emerald-50 rounded-lg p-4">
                    <h4 className="font-semibold text-sm text-emerald-900 mb-2">Materials needed</h4>
                    <div className="flex flex-wrap gap-2">
                      {detail.materials.map((m, i) => <Badge key={i} variant="outline" className="bg-white">{m}</Badge>)}
                    </div>
                  </div>
                )}

                <div className="space-y-4 text-gray-700 text-sm leading-relaxed" data-testid="content-detail-body">
                  {detail.body.split('\n\n').map((p, i) => <p key={i} className="whitespace-pre-wrap">{p}</p>)}
                </div>

                {detail.solution && (
                  <div className="border-t pt-4">
                    {!showSolution ? (
                      <Button variant="outline" onClick={() => setShowSolution(true)} className="border-purple-600 text-purple-600" data-testid="show-solution-btn">
                        💡 Show Solution
                      </Button>
                    ) : (
                      <div className="bg-purple-50 rounded-lg p-4 space-y-3">
                        <h4 className="font-semibold text-sm text-purple-900">Solution</h4>
                        {detail.solution.split('\n\n').map((p, i) => <p key={i} className="text-sm text-purple-900 whitespace-pre-wrap">{p}</p>)}
                      </div>
                    )}
                  </div>
                )}

                {detail.external_url && (
                  <a href={detail.external_url} target="_blank" rel="noopener noreferrer" className="block" data-testid="external-link-btn">
                    <Button variant="outline" className="w-full border-emerald-600 text-emerald-600 hover:bg-emerald-50">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Go deeper at {detail.external_label}
                    </Button>
                  </a>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ContentHub;
