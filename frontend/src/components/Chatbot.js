import React, { useState, useEffect } from "react";
import { TiArrowSortedDown } from "react-icons/ti";
import { RiRobot3Fill } from "react-icons/ri";
import { FaCommentAlt } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";
import ChatForm from "./ChatForm";
import "./Chatbot.css";
import ChatMessage from "./ChatMessage";
import axios from "axios";

const Chatbot = ({ sessionId, currentStage, projectMetadata }) => {
  const [chatHistory, setChatHistory] = useState([]);
  const [showChatbot, setShowChatbot] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const shouldShowChatbot = currentStage && 
    ["preview", "review"].includes(currentStage);

  useEffect(() => {
    if (shouldShowChatbot && chatHistory.length === 0) {
      setChatHistory([
        { 
          role: "model", 
          text: getWelcomeMessage(currentStage)
        }
      ]);
    }
  }, [currentStage, shouldShowChatbot]);

  useEffect(() => {
    if (shouldShowChatbot && chatHistory.length > 0) {
      const lastMessage = chatHistory[chatHistory.length - 1];
      
      if (lastMessage.role !== "model" || lastMessage.pageContext !== currentStage) {
        setChatHistory(history => [
          ...history,
          { 
            role: "model", 
            text: getWelcomeMessage(currentStage),
            pageContext: currentStage
          }
        ]);
      }
    }
  }, [currentStage]);

  const getWelcomeMessage = (stage) => {
    switch (stage) {
      case "upload":
        return "Need help with uploading your file or filling out the form?";
      case "preview":
        return "I can help you understand the manual coding interface. What would you like to know?";
      case "review":
        return "Questions about approving or rejecting classifications?";
      default:
        return "Hello!";
    }
  };

  const generateBotResponse = async (userMessage) => {
    if (!sessionId) return;
    
    const updatedHistory = [
      ...chatHistory,
      { role: "user", text: userMessage }
    ];
    
    setChatHistory(updatedHistory);
    
    setIsLoading(true);
    
    try {
      const response = await axios.post(`https://eduthemes.onrender.com/session/${sessionId}/analyze-text`, {
        message: userMessage,
        currentStage: currentStage,
        apiKey: projectMetadata?.apiKey || ""
      });
      
      if (response.data && response.data.response) {
        setChatHistory(currentHistory => [
          ...currentHistory,
          {
            role: "model",
            text: response.data.response,
            pageContext: currentStage
          }
        ]);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error) {
      console.error("Error generating bot response:", error);
      
      setChatHistory(currentHistory => [
        ...currentHistory,
        {
          role: "model",
          text: "I'm sorry, I encountered an error processing your question.",
          pageContext: currentStage
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!shouldShowChatbot) {
    return null;
  }

  return (
    <div className={`container ${showChatbot ? "show-chatbot" : ""}`}>
      <button
        className="chatbot-toggler d-flex justify-content-center align-items-center"
        onClick={() => setShowChatbot((prev) => !prev)}
      >
        <span>
          <FaCommentAlt className="on" />
        </span>
        <span>
          <IoMdClose className="off" />
        </span>
      </button>

      <div className="chat-popup">
        <div className="chat-header">
          <div className="header-info">
            <RiRobot3Fill className="bot-logo" />
            <div className="logo-text pt-1">Interface Help</div>
          </div>
          <button onClick={() => setShowChatbot((prev) => !prev)}>
            <TiArrowSortedDown />
          </button>
        </div>

        <div className="chat-body">
          {chatHistory.map((chat, index) => (
            <ChatMessage key={index} chat={chat} />
          ))}
          
          {isLoading && (
            <div className="message bot-message">
              <RiRobot3Fill className="bot-logo" />
              <p className="message-text">Thinking...</p>
            </div>
          )}
        </div>

        <div className="chat-footer">
          <ChatForm
            generateBotResponse={generateBotResponse}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
};

export default Chatbot;