import React, { useState, useEffect } from 'react';
import { Container, Button, Card, Row, Col, Modal, Badge, Spinner, Alert, ProgressBar } from 'react-bootstrap';
import { FaCheck, FaTimes, FaUndo } from 'react-icons/fa';
import axios from 'axios';

const Review = ({ sessionId, labels, setResults, dataset, setDataset, claudeData, onAdvanceStage, projectMetadata }) => {
    const [currentThemeIndex, setCurrentThemeIndex] = useState(0);
    const [responseActions, setResponseActions] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showReassignModal, setShowReassignModal] = useState(false);
    const [rejectedEntries, setRejectedEntries] = useState([]);
    
    const unclassifiedTheme = {
        name: "Unclassified",
        description: "Responses that don't fit any other theme",
        color: "#cccccc"
    };
    
    const hasUnclassifiedTheme = labels.some(label => label.name === "Unclassified");
    const allThemes = hasUnclassifiedTheme ? labels : [...labels, unclassifiedTheme];
    const currentTheme = allThemes[currentThemeIndex] || { name: "None", color: "#cccccc" };
    const themeResponses = claudeData?.[currentTheme.name] || [];
    
    useEffect(() => {
        if (!hasUnclassifiedTheme && claudeData && !claudeData["Unclassified"]) {
            const updatedClaudeData = {...claudeData};
            updatedClaudeData["Unclassified"] = [];
            if (typeof claudeData === 'object') {
                Object.assign(claudeData, updatedClaudeData);
            }
        }
    }, [claudeData, hasUnclassifiedTheme]);
    
    useEffect(() => {
        if (currentTheme && !responseActions[currentTheme.name]) {
            setResponseActions(prev => ({
                ...prev,
                [currentTheme.name]: Array(themeResponses.length).fill(null)
            }));
        }
    }, [currentTheme, themeResponses, responseActions]);

    const handleAction = (index, action) => {
        const updatedActions = [...(responseActions[currentTheme.name] || [])];
        updatedActions[index] = action;
        
        setResponseActions(prev => ({
            ...prev,
            [currentTheme.name]: updatedActions
        }));
    };

    const handleUndo = (index) => {
        const updatedActions = [...(responseActions[currentTheme.name] || [])];
        updatedActions[index] = null;
        
        setResponseActions(prev => ({
            ...prev,
            [currentTheme.name]: updatedActions
        }));
    };

    const handleAcceptAll = () => {
        setResponseActions(prev => ({
            ...prev,
            [currentTheme.name]: Array(themeResponses.length).fill('approve')
        }));
    };

    const handleRejectAll = () => {
        setResponseActions(prev => ({
            ...prev,
            [currentTheme.name]: Array(themeResponses.length).fill('deny')
        }));
    };

    const addToUnclassified = (rejectedIndices) => {
        if (rejectedIndices.length === 0) return;
        
        if (!claudeData["Unclassified"]) {
            claudeData["Unclassified"] = [];
        }

        const unclassifiedSet = new Set(claudeData["Unclassified"]);
        
        rejectedIndices.forEach(idx => {
            if (!unclassifiedSet.has(idx)) {
                unclassifiedSet.add(idx);
            }
        });
        
        claudeData["Unclassified"] = Array.from(unclassifiedSet);
        
        if (!responseActions["Unclassified"]) {
            setResponseActions(prev => ({
                ...prev,
                "Unclassified": Array(claudeData["Unclassified"].length).fill(null)
            }));
        } else {
            const existingLength = responseActions["Unclassified"].length;
            const newLength = claudeData["Unclassified"].length;
            
            if (newLength > existingLength) {
                const updatedActions = [
                    ...responseActions["Unclassified"], 
                    ...Array(newLength - existingLength).fill(null)
                ];
                
                setResponseActions(prev => ({
                    ...prev,
                    "Unclassified": updatedActions
                }));
            }
        }
    };

    const handleNextTheme = () => {
        const rejectedIndices = (responseActions[currentTheme.name] || [])
            .map((action, idx) => (action === 'deny' ? themeResponses[idx] : null))
            .filter(index => index !== null);

        if (rejectedIndices.length > 0) {
            setRejectedEntries(rejectedIndices);
            setShowReassignModal(true);
        } else if (currentThemeIndex < allThemes.length - 1) {
            setCurrentThemeIndex(currentThemeIndex + 1);
        } else {
            handleSubmitFinalDataset();
        }
    };

    const handleFinishReassignment = () => {
        rejectedEntries.forEach((rejectedIndex) => {
            const currentThemeResponses = claudeData[currentTheme.name];
            if (currentThemeResponses) {
                claudeData[currentTheme.name] = currentThemeResponses.filter(
                    (responseIndex) => responseIndex !== rejectedIndex
                );
            }

            const isInOtherThemes = Object.keys(claudeData).some((themeName) => {
                if (themeName !== currentTheme.name) {
                    return claudeData[themeName]?.includes(rejectedIndex);
                }
                return false;
            });

            if (!isInOtherThemes) {
                if (!claudeData["Unclassified"]) {
                    claudeData["Unclassified"] = [];
                }
                if (!claudeData["Unclassified"].includes(rejectedIndex)) {
                    claudeData["Unclassified"].push(rejectedIndex);
                }
            }
        });

        setShowReassignModal(false);

        if (currentThemeIndex >= allThemes.length - 1) {
            handleSubmitFinalDataset();
        } else {
            setCurrentThemeIndex(currentThemeIndex + 1);
        }
    };

    const handleSubmitFinalDataset = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const updatedDataset = [...dataset];

            Object.keys(responseActions).forEach(themeName => {
                const themeActions = responseActions[themeName];
                const themeResponseIndices = claudeData[themeName] || [];

                themeActions.forEach((action, idx) => {
                    if (action === 'approve' || themeName === "Unclassified") {
                        const responseIndex = themeResponseIndices[idx];
                        if (responseIndex !== undefined && responseIndex < updatedDataset.length) {
                            const theme = allThemes.find(label => label.name === themeName);

                            if (theme) {
                                if (!updatedDataset[responseIndex].themes) {
                                    updatedDataset[responseIndex].themes = [];
                                }

                                const themeExists = updatedDataset[responseIndex].themes.some(
                                    t => t.name === theme.name
                                );

                                if (!themeExists) {
                                    updatedDataset[responseIndex].themes.push({
                                        name: theme.name,
                                        color: theme.color,
                                        description: theme.description || ""
                                    });
                                }
                            }
                        }
                    }
                });
            });

            setDataset(updatedDataset);

            const response = await axios.post(
                `https://eduthemes.onrender.com/session/${sessionId}/submit-final-dataset`,
                { 
                    dataset: updatedDataset,
                    apiKey: projectMetadata.apiKey
                }
            );

            if (response.status === 200) {
                setResults(response.data.themes);
                onAdvanceStage();
            } else {
                setError('Error submitting final dataset: ' + (response.data.error || 'Unknown error'));
            }
        } catch (error) {
            setError('Failed to submit final dataset: ' + (error.response?.data?.error || error.message));
        } finally {
            setIsLoading(false);
        }
    };
    
    const currentActions = responseActions[currentTheme.name] || Array(themeResponses.length).fill(null);
    const allActionsCompleted = currentTheme.name === "Unclassified" || currentActions.every(action => action !== null);
    
    const totalThemes = allThemes.length;
    const completedThemes = Object.keys(responseActions).filter(theme => {
        const actions = responseActions[theme];
        return actions && actions.every(action => action !== null);
    }).length;
    
    const progressPercentage = currentTheme.name === "Unclassified" 
        ? 100 
        : totalThemes > 0 
            ? (completedThemes / totalThemes) * 100 
            : 0;
    const formattedThemeName = `${currentTheme.name} (${themeResponses.length} responses)`;

    return (
        <Container fluid className="d-flex justify-content-center align-items-start p-0" style={{ padding: '0', height: '90vh' }}>
            <Row className="h-100 m-0 w-100 gap-3">
                <Col xs={3} className="p-2 bg-light h-100">
                    <Card className="mb-2" style={{ height: '20%' }}>
                        <Card.Body className="rounded d-flex flex-column">
                            <h5>Theme Review</h5><hr/>
                            <p className="text-muted">
                                Review the AI-generated classifications by theme. Approve or reject each classification.
                            </p>
                            {error && <Alert variant="danger">{error}</Alert>}
                        </Card.Body>
                    </Card>
                    <Card className="mb-2" style={{ height: '28%' }}>
                        <Card.Body className="rounded d-flex flex-column">
                            <strong>Current Theme</strong><hr/>
                            <div className="d-flex align-items-center mb-2">
                                <div 
                                    style={{ 
                                        width: '20px', 
                                        height: '20px', 
                                        borderRadius: '50%', 
                                        backgroundColor: currentTheme.color,
                                        marginRight: '10px'
                                    }}
                                ></div>
                                <h5 className="mb-0">{currentTheme.name}</h5>
                            </div>
                            <div style={{ overflowY: 'auto', maxHeight: '110px' }}>
                                <p>{currentTheme.description || "No description available"} </p>
                            </div>
                            
                        </Card.Body>
                    </Card>
                    <Card className="flex-grow-1" style={{height: '50%' }}>
                        <Card.Body className="rounded d-flex flex-column">
                            <strong>Progress</strong><hr/>
                            
                            <p className="text-muted">
                                Reviewing theme {currentThemeIndex + 1} of {totalThemes}
                            </p>
                            <p>
                                <strong>Theme List:</strong>
                            </p>
                            <div style={{ overflowY: 'auto', maxHeight: '235px' }}>
                                {allThemes.map((label, index) => {
                                    const isComplete = responseActions[label.name] && 
                                        responseActions[label.name].every(action => action !== null);
                                    
                                    return (
                                        <div 
                                            key={index}
                                            className="d-flex align-items-center mb-2"
                                            style={{ opacity: index === currentThemeIndex ? 1 : 0.7 }}
                                        >
                                            <div 
                                                style={{ 
                                                    width: '12px', 
                                                    height: '12px', 
                                                    borderRadius: '50%', 
                                                    backgroundColor: isComplete ? '#28a745' : '#6c757d',
                                                    marginRight: '10px'
                                                }}
                                            ></div>
                                            <span>
                                                {label.name}
                                                {index === currentThemeIndex && ' (current)'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card.Body>
                    </Card>
                </Col>

                <Col xs={8} className="p-2 h-100 d-flex bg-light flex-column">
                    <Card className="flex-grow-1">
                        <Card.Header className="d-flex flex-column align-items-center">
                            <div className="d-flex justify-content-between w-100 mt-2 align-items-center">
                                <h5>
                                    {formattedThemeName}
                                </h5>
                                <Button 
                                    variant="primary" 
                                    onClick={handleNextTheme} 
                                    disabled={(!allActionsCompleted || isLoading)}
                                >
                                    {isLoading ? (
                                        <>
                                            <Spinner 
                                                as="span" 
                                                animation="border" 
                                                size="sm" 
                                                role="status" 
                                                aria-hidden="true" 
                                            /> 
                                            &nbsp;&nbsp;Processing...
                                        </>
                                    ) : (
                                        currentThemeIndex >= allThemes.length - 1 ? 'Finish' : 'Next Theme'
                                    )}
                                </Button>
                            </div>
                        </Card.Header>
                        
                        <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center">
                            <ProgressBar 
                                now={progressPercentage} 
                                label={`${Math.round(progressPercentage)}%`}
                                variant="info" 
                                className="mb-0" // Remove margin below if vertically aligned
                                style={{ width: '60%' }} // Optional: limit width so buttons fit well
                            />
                            <div className="d-flex">
                                <Button 
                                    className="me-2" 
                                    variant="success" 
                                    size="sm" 
                                    onClick={handleAcceptAll} 
                                    disabled={currentTheme.name === "Unclassified"}
                                >
                                    Accept All
                                </Button>
                                <Button 
                                    variant="danger" 
                                    size="sm" 
                                    onClick={handleRejectAll} 
                                    disabled={currentTheme.name === "Unclassified"}
                                >
                                    Reject All
                                </Button>
                            </div>
                        </div>
                        <Card.Body style={{ height: '1px' }}>
                            <div 
                                style={{ overflowY: 'auto', width: '100%', padding: '10px', height: '100%' }}
                                className="bg-light border rounded"
                            >
                                {themeResponses.length > 0 ? (
                                    themeResponses.map((responseIndex, idx) => {
                                        const responseText = responseIndex < dataset.length ? 
                                            dataset[responseIndex].original : 
                                            "Response not found";
                                            
                                        return (
                                            <div 
                                                key={`${currentTheme.name}-${idx}`} 
                                                className={`p-2 border-bottom d-flex justify-content-between align-items-center`}
                                                style={{ 
                                                    textAlign: 'left', 
                                                    backgroundColor: currentActions[idx] === 'approve' ? 
                                                        '#d4edda' : currentActions[idx] === 'deny' ? 
                                                        '#f8d7da' : 'transparent' 
                                                }}
                                            >
                                                <span>
                                                    {responseText}
                                                </span>
                                                <div 
                                                    className="d-flex flex-column" 
                                                    style={{ 
                                                        height: '60px', 
                                                        justifyContent: currentActions[idx] === null ? 
                                                            'space-between' : 'center' 
                                                    }}
                                                >
                                                    {currentActions[idx] === null && currentTheme.name !== "Unclassified" && (
                                                        <>
                                                            <Button 
                                                                variant="success" 
                                                                className="d-flex align-items-center" 
                                                                size="sm"
                                                                onClick={() => handleAction(idx, 'approve')}
                                                            >
                                                                <FaCheck/>
                                                            </Button>
                                                            <Button 
                                                                variant="danger" 
                                                                className="d-flex align-items-center" 
                                                                size="sm"
                                                                onClick={() => handleAction(idx, 'deny')}
                                                            >
                                                                <FaTimes/>
                                                            </Button>
                                                        </>
                                                    )}
                                                    {currentActions[idx] !== null && currentTheme.name !== "Unclassified" && (
                                                        <Button 
                                                            variant="secondary" 
                                                            className="d-flex align-items-center" 
                                                            size="sm"
                                                            onClick={() => handleUndo(idx)}
                                                        >
                                                            <FaUndo/>
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-muted text-center my-4">
                                        No responses were classified with this theme.
                                    </p>
                                )}
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Modal 
                show={showReassignModal} 
                onHide={() => setShowReassignModal(false)}
                centered
            >
                <Modal.Header closeButton>
                    <Modal.Title>Rejected Classifications</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>
                        You've rejected {rejectedEntries.length} classifications for the theme "{currentTheme.name}".
                        Rejected items will move to the "Unclassified" category if they have no other assignments.
                    </p>
                    <p>
                        Continue to {currentThemeIndex >= allThemes.length - 1 ? 'finish the review' : 'the next theme'}?
                    </p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowReassignModal(false)}>
                        Go Back
                    </Button>
                    <Button variant="primary" onClick={handleFinishReassignment}>
                        {currentThemeIndex >= allThemes.length - 1 ? 'Finish Review' : 'Next Theme'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default Review;