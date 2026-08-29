import React, { useState, useEffect, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthContext } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import axios from 'axios';
import { toast } from 'sonner';
import { subjectEmoji, difficultyColor } from '../lib/steam';
import { notifyNewBadges } from '../lib/badges';

const ActivitiesPage = () => {
  const { user, API } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();

  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const [dragItems, setDragItems] = useState([]);
  const [dropZones, setDropZones] = useState([]);
  const [completedMatches, setCompletedMatches] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [rewards, setRewards] = useState(null);

  useEffect(() => {
    fetchActivities();
  }, []);

  useEffect(() => {
    const startId = searchParams.get('start');
    if (startId && activities.length > 0 && !selectedActivity) {
      const activity = activities.find((a) => a.id === startId);
      if (activity) startActivity(activity);
    }
  }, [activities, searchParams]);

  const fetchActivities = async () => {
    try {
      const params = {};
      if (user?.age_group) params.age_group = user.age_group;
      const response = await axios.get(`${API}/activities`, { params });
      setActivities(response.data);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const startActivity = (activity) => {
    setSelectedActivity(activity);
    if (activity.type === 'matching') {
      const shuffledItems = [...activity.content.items].sort(() => Math.random() - 0.5);
      setDragItems(shuffledItems);
      setDropZones(activity.content.matches.map((match) => ({ ...match, droppedItem: null })));
      setCompletedMatches([]);
      setShowResults(false);
      setScore(0);
      setRewards(null);
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (destination.droppableId.startsWith('drop-zone-')) {
      const zoneIndex = parseInt(destination.droppableId.split('-')[2], 10);
      const draggedItem = dragItems[source.index];
      const newDropZones = [...dropZones];
      newDropZones.forEach((zone) => {
        if (zone.droppedItem?.id === draggedItem.id) zone.droppedItem = null;
      });
      newDropZones[zoneIndex].droppedItem = draggedItem;
      setDropZones(newDropZones);
    }
  };

  const checkAnswers = async () => {
    let correct = 0;
    const matches = [];
    dropZones.forEach((zone) => {
      if (zone.droppedItem && zone.droppedItem.match === zone.id) {
        correct++;
        matches.push({ zoneId: zone.id, correct: true });
      } else if (zone.droppedItem) {
        matches.push({ zoneId: zone.id, correct: false });
      }
    });
    const finalScore = Math.round((correct / selectedActivity.content.matches.length) * 100);
    setCompletedMatches(matches);
    setScore(finalScore);
    setShowResults(true);
    try {
      const res = await axios.post(`${API}/activities/${selectedActivity.id}/complete`, { score: finalScore });
      setRewards(res.data);
      if (res.data.first_completion) {
        toast.success(`Activity complete! +${res.data.points_earned} points ⭐`);
      }
      notifyNewBadges(res.data.new_badges);
    } catch (e) {
      console.error('Failed to save activity result:', e);
    }
  };

  const resetActivity = () => {
    setSelectedActivity(null);
    setDragItems([]);
    setDropZones([]);
    setCompletedMatches([]);
    setShowResults(false);
    setScore(0);
    setRewards(null);
    if (searchParams.get('start')) setSearchParams({});
  };

  const filteredActivities = activities.filter((activity) => {
    if (filter === 'all') return true;
    return activity.subject.toLowerCase() === filter.toLowerCase() ||
      activity.difficulty.toLowerCase() === filter.toLowerCase();
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading activities...</p>
        </div>
      </div>
    );
  }

  if (selectedActivity) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold text-gray-900">{selectedActivity.title}</h1>
              <Button onClick={resetActivity} variant="outline" data-testid="exit-activity-btn">
                Exit Activity
              </Button>
            </div>
            <p className="text-lg text-gray-600 mb-4">{selectedActivity.description}</p>
            {!showResults && (
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
                <p className="text-blue-800">
                  <strong>Instructions:</strong> Drag items from the left and drop them into the correct matching zones on the right.
                </p>
              </div>
            )}
          </div>

          {showResults ? (
            <Card className="bg-white/90 backdrop-blur-sm shadow-xl max-w-2xl mx-auto">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl text-gray-900">Activity Complete! 🎉</CardTitle>
                <CardDescription className="text-lg">Great job working through this matching activity!</CardDescription>
              </CardHeader>
              <CardContent className="text-center space-y-6">
                <div className="space-y-4">
                  <div className="text-6xl font-bold text-emerald-600" data-testid="activity-score">{score}%</div>
                  <div className="text-xl text-gray-700">
                    You matched {completedMatches.filter((m) => m.correct).length} out of {selectedActivity.content.matches.length} items correctly!
                  </div>
                  <div className="flex justify-center gap-3 flex-wrap">
                    <Badge
                      variant={score >= 80 ? 'default' : score >= 60 ? 'secondary' : 'destructive'}
                      className="text-lg px-4 py-2"
                    >
                      {score >= 80 ? 'Excellent! 🌟' : score >= 60 ? 'Good Job! 👍' : 'Keep Practicing! 💪'}
                    </Badge>
                    {rewards && (
                      <>
                        <Badge className="text-lg px-4 py-2 bg-yellow-100 text-yellow-800" data-testid="activity-points-earned">
                          ⭐ +{rewards.points_earned} points
                        </Badge>
                        <Badge className="text-lg px-4 py-2 bg-orange-100 text-orange-800">
                          🔥 {rewards.streak_days}-day streak
                        </Badge>
                      </>
                    )}
                  </div>
                  {rewards && !rewards.first_completion && (
                    <p className="text-sm text-gray-500">Points are only awarded the first time you complete each activity.</p>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button onClick={() => startActivity(selectedActivity)} className="bg-emerald-600 hover:bg-emerald-700" data-testid="retry-activity-btn">
                    Try Again
                  </Button>
                  <Button onClick={resetActivity} variant="outline" data-testid="back-to-activities-btn">
                    Back to Activities
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="grid lg:grid-cols-2 gap-8">
                <Card className="bg-white/90 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <span className="text-2xl">📦</span>
                      <span>Items to Match</span>
                    </CardTitle>
                    <CardDescription>Drag these items to the correct zones</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Droppable droppableId="drag-items">
                      {(provided, snapshot) => (
                        <div
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className={`min-h-[300px] p-4 rounded-lg border-2 border-dashed transition-colors ${
                            snapshot.isDraggingOver ? 'border-emerald-400 bg-emerald-50' : 'border-gray-300 bg-gray-50'
                          }`}
                        >
                          <div className="grid gap-3">
                            {dragItems.map((item, index) => {
                              const isUsed = dropZones.some((zone) => zone.droppedItem?.id === item.id);
                              return (
                                <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={isUsed}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={`p-4 bg-white rounded-lg shadow-sm border-2 transition-all ${
                                        snapshot.isDragging
                                          ? 'border-emerald-400 shadow-lg transform rotate-2'
                                          : isUsed
                                            ? 'border-gray-200 opacity-50 cursor-not-allowed'
                                            : 'border-gray-200 hover:border-emerald-300 hover:shadow-md cursor-move'
                                      }`}
                                      data-testid={`drag-item-${item.id}`}
                                    >
                                      <span className="font-semibold text-gray-900">{item.text}</span>
                                    </div>
                                  )}
                                </Draggable>
                              );
                            })}
                          </div>
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </CardContent>
                </Card>

                <Card className="bg-white/90 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <span className="text-2xl">🎯</span>
                      <span>Matching Zones</span>
                    </CardTitle>
                    <CardDescription>Drop items into their correct matches</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dropZones.map((zone, index) => (
                        <Droppable key={zone.id} droppableId={`drop-zone-${index}`}>
                          {(provided, snapshot) => (
                            <div
                              {...provided.droppableProps}
                              ref={provided.innerRef}
                              className={`min-h-[80px] p-4 rounded-lg border-2 border-dashed transition-all ${
                                snapshot.isDraggingOver
                                  ? 'border-emerald-400 bg-emerald-50'
                                  : zone.droppedItem
                                    ? 'border-emerald-300 bg-emerald-50'
                                    : 'border-gray-300 bg-gray-50'
                              }`}
                              data-testid={`drop-zone-${zone.id}`}
                            >
                              <div className="text-sm font-medium text-gray-700 mb-2">{zone.text}</div>
                              {zone.droppedItem ? (
                                <div className="p-3 bg-white rounded-lg shadow-sm border-2 border-emerald-300">
                                  <span className="font-semibold text-gray-900">{zone.droppedItem.text}</span>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center h-12 text-gray-400 text-sm">
                                  Drop item here
                                </div>
                              )}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-8 text-center">
                <Button
                  onClick={checkAnswers}
                  className="bg-emerald-600 hover:bg-emerald-700 px-8 py-3 text-lg"
                  disabled={dropZones.every((zone) => !zone.droppedItem)}
                  data-testid="check-answers-btn"
                >
                  Check Answers
                </Button>
              </div>
            </DragDropContext>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Interactive Activities 🎯</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Hands-on activities for your age group{user?.age_group ? ` (${user.age_group})` : ''}. First completions earn 50 points!
          </p>
        </div>

        <div className="flex flex-wrap gap-4 justify-center mb-8">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48" data-testid="activity-filter-select">
              <SelectValue placeholder="Filter by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Activities</SelectItem>
              <SelectItem value="science">Science</SelectItem>
              <SelectItem value="technology">Technology</SelectItem>
              <SelectItem value="engineering">Engineering</SelectItem>
              <SelectItem value="arts">Arts</SelectItem>
              <SelectItem value="mathematics">Mathematics</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredActivities.length === 0 ? (
          <Card className="bg-white/70 backdrop-blur-sm max-w-md mx-auto">
            <CardContent className="text-center py-12">
              <div className="text-6xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Activities Found</h3>
              <p className="text-gray-600 mb-6">No activities match your current filter. Try adjusting your selection.</p>
              <Button onClick={() => setFilter('all')} className="bg-emerald-600 hover:bg-emerald-700">
                Show All Activities
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredActivities.map((activity) => (
              <Card key={activity.id} className="bg-white/70 backdrop-blur-sm hover:shadow-xl transition-all duration-300 card-hover">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex space-x-2">
                      <Badge className={difficultyColor(activity.difficulty)}>{activity.difficulty}</Badge>
                      <Badge variant="outline">{activity.type}</Badge>
                    </div>
                    <span className="text-2xl">{subjectEmoji(activity.subject)}</span>
                  </div>
                  <CardTitle className="text-xl text-gray-900">{activity.title}</CardTitle>
                  <CardDescription className="text-gray-600">{activity.description}</CardDescription>
                  <div className="text-sm text-gray-500">Subject: {activity.subject}</div>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => startActivity(activity)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 btn-hover-scale"
                    data-testid={`start-activity-${activity.id}`}
                  >
                    Start Activity
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivitiesPage;
