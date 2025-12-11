This project provides a simple Flask web app that accepts image uploads, sends them to the SDXL Organika model (hosted via Hugging Face or locally), and returns a prediction with a confidence score indicating probability of human vs artificial (AI-generated). The frontend shows a confidence meter and a final decision.

requirements:
flask==2.3.3
requests==2.31.0
python-multipart==0.0.6
Pillow==10.0.0
torch>=2.0.0          
transformers>=4.30.0  
diffusers>=0.18.0   
gunicorn==21.2.0
python-dotenv==1.0.0
tqdm==4.65.0


