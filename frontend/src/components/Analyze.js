import React, { useState, useEffect } from "react";
import { Button, Container, OverlayTrigger, Card, Row, Col, Tab, Tabs, Tooltip } from "react-bootstrap";
import { Chart as ChartJS, ArcElement, Legend, Tooltip as ChartTooltip , CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Bar, Doughnut } from "react-chartjs-2";
import axios from "axios";
import "./Analyze.css";
import ReactMarkdown from 'react-markdown';

ChartJS.register(
  ChartTooltip,
  ArcElement, 
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

const Analyze = ({labels, results, onAdvanceStage, sessionId }) => {
  const [summary, setSummary] = useState("");
  
  useEffect(() => {
    if (results && results.summary) {
      setSummary(results.summary);
    } else {
      const fetchSummary = async () => {
        try {
          const response = await axios.get(`https://eduthemes.onrender.com/session/${sessionId}/download-final-dataset`);
          if (response.data && response.data.summary) {
            setSummary(response.data.summary);
          }
        } catch (error) {
          console.error("Error fetching summary:", error);
        }
      };
      
      fetchSummary();
    }
  }, [results, sessionId]);

  const handleDownloadJSON = async () => {
    try {
      const response = await axios.get(`https://eduthemes.onrender.com/session/${sessionId}/download-final-dataset`);
      const data = response.data;

      if (response.status === 200) {
        const blob = new Blob([JSON.stringify(data.final_dataset, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "final_dataset.json";
        link.click();
        URL.revokeObjectURL(url);
      } else {
        console.error("Error downloading dataset:", data.error);
      }
    } catch (error) {
      console.error("Error fetching dataset:", error);
    }
  };
  
  const handleDownloadSummary = () => {
    if (summary) {
      const blob = new Blob([summary], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "qualitative_analysis_summary.txt";
      link.click();
      URL.revokeObjectURL(url);
    }
  };


  const labelMap = React.useMemo(() => {
    const map = {};
    if (labels && Array.isArray(labels)) {
      labels.forEach(label => {
        map[label.name] = label.definition || label.description || "No definition available.";
      });
    }
    return map;
  }, [labels]);

  const themeData = results || [];
  
  return (
    <Container className="my-4">
      <Card className="shadow-sm mb-4">
        <Card.Header className="bg-primary text-white">
          <h3 className="mb-0">Analysis Results</h3>
        </Card.Header>
      </Card>
      
      <Tabs defaultActiveKey="summary" className="mb-4">
        <Tab eventKey="summary" title="Summary">
          <Card className="shadow-sm">
            <Card.Body>
              <div className="mb-3 d-flex justify-content-end">
                <Button 
                  variant="outline-primary" 
                  onClick={handleDownloadSummary}
                  className="me-2"
                >
                  Download Summary
                </Button>
              </div>
              <div className="summary-content p-3">
                <ReactMarkdown>
                  {summary || "No summary available."}
                </ReactMarkdown>
              </div>
            </Card.Body>
          </Card>
        </Tab>
        
        <Tab eventKey="visualization" title="Visualizations">
          <Row>
            <Col md={6}>
              <Card className="shadow-sm mb-4">
                <Card.Header>Theme Distribution</Card.Header>
                <Card.Body className="d-flex justify-content-center">
                  <div style={{ width: '100%', maxWidth: '400px', height: '400px'}} >
                    <Doughnut
                      data={{
                        labels: themeData.map((item) => item.name),
                        datasets: [
                          {
                            label: "Count",
                            data: themeData.map((item) => item.frequency),
                            backgroundColor: themeData.map((item) => item.color),
                            borderColor: themeData.map((item) => item.color),
                          },
                        ],
                      }}
                      options={{
                        plugins: {
                          legend: {
                            display: false,

                            position: "bottom",
                          },
                          title: {
                            display: false,
                            text: "Hover over to see which theme it is!",
                          },
                        },
                      }}
                    />
                  </div>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={6}>
              <Card className="shadow-sm mb-4" style={{ height: '475px' }}>
                <Card.Header>Theme Frequency</Card.Header>
                <Card.Body >
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Bar

                    data={{
                      labels: themeData.map((item) => item.name),
                      datasets: [
                        {
                          label: "Response Count",
                          data: themeData.map((item) => item.frequency),
                          backgroundColor: themeData.map((item) => item.color),
                          borderColor: themeData.map((item) => item.color),
                          borderRadius: 5,
                        },
                      ],
                    }}
                    options={{
                      indexAxis: 'x',
                      plugins: {
                        legend: {
                          display: false,
                        },
                      },
                      
                    }}
                  />
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Tab>
        
        <Tab eventKey="themes" title="Theme List">
          <Card className="shadow-sm">
            <Card.Body>
              <div className="mb-3 d-flex justify-content-end">
                <Button 
                  variant="outline-primary" 
                  onClick={handleDownloadJSON}
                  className="me-2"
                >
                  Download Dataset (JSON)
                </Button>
              </div>
              
              <div className="themes-grid p-3">
                {themeData && themeData.length > 0 ? (
                  <div className="d-flex flex-wrap justify-content-center gap-3">
                    {themeData.map((item, index) => (
                      <OverlayTrigger
                        key={index}
                        delay={{ hide: 450, show: 300 }}
                        overlay={(props) => (
                          <Tooltip {...props} >
                            <div style={{ fontSize: '1.2em',  borderRadius: '5px' }}>
                              Definition - {labelMap[item.name] || "No description available"}
                            </div>
                          </Tooltip>
                        )}
                        placement="bottom"
                      >
                        <div 
                          key={index}
                          className="theme-card p-3 rounded"
                          style={{ 
                            backgroundColor: item.color, 
                            color: isDarkColor(item.color) ? 'white' : 'black',
                            minWidth: '200px',
                            textAlign: 'center',
                          }}
                        >
                          <h5>{item.name}</h5>
                          <p className="mb-0">
                            <strong>{item.frequency}</strong> responses
                          </p>
                        </div>
                      </OverlayTrigger>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted">No themes available.</p>
                )}
              </div>
            </Card.Body>
          </Card>
        </Tab>
        
      </Tabs>
      
      <div className="d-flex justify-content-center mt-4">
        <Button 
          variant="primary" 
          size="lg"
          onClick={() => onAdvanceStage()}
          style={{ marginBottom: '20px' }}
        >
          Start New Analysis
        </Button>
      </div>
    </Container>
  );
};

function isDarkColor(color) {
  let hex = color.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance < 0.5;
}

export default Analyze;